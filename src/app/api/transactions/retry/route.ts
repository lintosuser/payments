import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/payment";
import { buildExpdate } from "@/lib/tranzila";
import { dbExec, dbOne } from "@/lib/db";
import { createInvoiceReceipt, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { dispatchInvoiceToBookkeeping } from "@/lib/bookkeeping";
import { logAudit, getIp } from "@/lib/audit";

const COIN_CODE: Record<number, "ILS" | "USD" | "EUR" | "GBP"> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

/**
 * POST /api/transactions/retry  { txId }
 * Manually retry a failed token charge using the client's saved card token.
 * Inserts a fresh transaction row with the result. Does NOT touch the
 * subscription schedule (that already advanced) — this is a make-up charge.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { txId } = await req.json();
    if (!txId) return NextResponse.json({ error: "txId נדרש" }, { status: 400 });

    const tx = await dbOne<{
      id: string; client_id: string | null; amount: number; coin: number; info: string;
      token: string | null; token_exp_month: string | null; token_exp_year: string | null;
      l4digit: string | null; email: string | null;
      business_name: string | null; first_name: string | null; last_name: string | null;
    }>`
      SELECT t.id, t.client_id, t.amount, t.coin, t.info,
             c.token, c.token_exp_month, c.token_exp_year, c.l4digit, c.email,
             c.business_name, c.first_name, c.last_name
      FROM dbo.transactions t
      LEFT JOIN dbo.clients c ON c.id = t.client_id
      WHERE t.id = ${txId}`;
    if (!tx) return NextResponse.json({ error: "עסקה לא נמצאה" }, { status: 404 });
    if (!tx.client_id) return NextResponse.json({ error: "לעסקה אין לקוח מקושר" }, { status: 400 });
    if (!tx.token) {
      return NextResponse.json({ error: "אין כרטיס שמור ללקוח — בקש כרטיס חדש (צור קישור תשלום)" }, { status: 400 });
    }

    const provider = getProvider();
    if (!provider.isConfigured()) return NextResponse.json({ error: "ספק התשלום לא מוגדר" }, { status: 500 });

    const contact = tx.business_name?.trim() || `${tx.first_name || ""} ${tx.last_name || ""}`.trim();
    const result = await provider.chargeToken({
      token: tx.token,
      expdate: buildExpdate(tx.token_exp_month || "", tx.token_exp_year || ""),
      amount: Number(tx.amount),
      info: tx.info,
      contact,
      email: tx.email || undefined,
      currency: tx.coin as 1 | 2 | 3 | 4,
    });

    const status = result.success ? "approved" : "failed";
    const newRow = await dbOne<{ id: string }>`
      INSERT INTO dbo.transactions (yaad_id, client_id, amount, coin, status, ccode, acode, info, hesh, type, l4digit, brand)
      OUTPUT inserted.id
      VALUES (${result.providerTxId || ""}, ${tx.client_id}, ${tx.amount}, ${tx.coin},
              ${status}, ${result.responseCode || ""}, ${result.confirmationCode || ""},
              ${tx.info}, '', 'subscription', ${result.last4 || tx.l4digit || ""}, ${result.brand || ""})`;

    await logAudit({
      user, action: "payment.charge", ip: getIp(req),
      entity: "transaction", entityId: newRow?.id || "",
      details: { retryOf: txId, success: result.success, code: result.responseCode },
    });

    if (result.success && newRow?.id && isInvoicingConfigured() && tx.email) {
      try {
        const inv = await createInvoiceReceipt({
          clientName: contact, clientEmail: tx.email, description: tx.info || "תשלום",
          amount: Number(tx.amount), currency: COIN_CODE[tx.coin] || "ILS",
          tranzilaIndex: result.providerTxId || "", cardLast4: result.last4 || tx.l4digit || "",
        });
        if (inv.ok && inv.docNumber) {
          const invoiceUrl = inv.retrievalKey ? `https://my.tranzila.com/api/get_financial_document/${inv.retrievalKey}` : "";
          await dbExec`UPDATE dbo.transactions SET hesh = ${inv.docNumber}, invoice_url = ${invoiceUrl} WHERE id = ${newRow.id}`;
          if (invoiceUrl) {
            await dispatchInvoiceToBookkeeping({
              txId: newRow.id, invoiceUrl, docNumber: inv.docNumber,
              amount: Number(tx.amount), currency: tx.coin, description: tx.info || "תשלום",
            });
          }
        }
      } catch (e) { console.error("[retry] invoice error", e); }
    }

    return NextResponse.json({
      ok: result.success,
      responseCode: result.responseCode,
      message: result.success ? "" : provider.errorMessage(result.responseCode),
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
