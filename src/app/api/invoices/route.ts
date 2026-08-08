import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { requireUser } from "@/lib/auth";
import { createInvoiceReceipt, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { clientDisplayName } from "@/lib/client-name";
import { dbExec, dbOne } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

const COIN_CODE: Record<number, "ILS" | "USD" | "EUR" | "GBP"> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

interface TxRow {
  id: string; yaad_id: string; amount: number; coin: number; info: string; l4digit: string;
  hesh: string; invoice_url: string; client_id: string | null;
  client_business_name: string | null; client_first_name: string | null;
  client_last_name: string | null; client_email: string | null; client_user_id: string | null;
}

async function loadTx(transId: string): Promise<TxRow | null> {
  return dbOne<TxRow>`
    SELECT t.id, t.yaad_id, t.amount, t.coin, t.info, t.l4digit, t.hesh, t.invoice_url, t.client_id,
           c.business_name AS client_business_name, c.first_name AS client_first_name,
           c.last_name AS client_last_name, c.email AS client_email, c.user_id AS client_user_id
    FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
    WHERE t.yaad_id = ${transId}`;
}

/**
 * POST /api/invoices
 *   { transId }                — return existing URL if invoiced, otherwise create + email
 *   { transId, force: true }   — always create a new invoice (for corrections)
 *   { transId, ...YaadPay }    — (YaadPay path) hosted invoice URL via the provider
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (getProvider().name === "tranzila") {
      if (!isInvoicingConfigured()) {
        return NextResponse.json({ error: "Tranzila Documents API לא מוגדר (TRANZILA_APP_KEY/SECRET)" }, { status: 501 });
      }
      if (!body.transId) {
        return NextResponse.json({ error: "transId נדרש" }, { status: 400 });
      }
      const tx = await loadTx(body.transId);
      if (!tx) return NextResponse.json({ error: "עסקה לא נמצאה" }, { status: 404 });

      // Already invoiced + no force → hand back the existing URL (or just the
      // doc number if we never recorded the URL, e.g. for invoices issued
      // before the invoice_url column existed).
      if (tx.hesh && tx.hesh !== "0" && !body.force) {
        return NextResponse.json({
          ok: true,
          existing: true,
          docNumber: tx.hesh,
          invoiceUrl: tx.invoice_url || null,
        });
      }

      if (!tx.client_email) return NextResponse.json({ error: "אין אימייל ללקוח" }, { status: 400 });

      const inv = await createInvoiceReceipt({
        clientName: clientDisplayName({
          business_name: tx.client_business_name,
          first_name: tx.client_first_name,
          last_name: tx.client_last_name,
        }),
        clientEmail: tx.client_email,
        clientId: tx.client_user_id || undefined,
        description: tx.info || "תשלום",
        amount: Number(tx.amount),
        currency: COIN_CODE[tx.coin] || "ILS",
        tranzilaIndex: tx.yaad_id,
        cardLast4: tx.l4digit || "",
      });
      if (!inv.ok) return NextResponse.json({ error: inv.error || "שגיאה ביצירת חשבונית" }, { status: 502 });

      const invoiceUrl = inv.retrievalKey
        ? `https://my.tranzila.com/api/get_financial_document/${inv.retrievalKey}`
        : "";
      await dbExec`
        UPDATE dbo.transactions
        SET hesh = ${inv.docNumber || ""},
            invoice_url = ${invoiceUrl}
        WHERE id = ${tx.id}`;
      await logAudit({
        user, action: "invoice.create", ip: getIp(req),
        entity: "transaction", entityId: body.transId,
        details: { docNumber: inv.docNumber, force: body.force || false },
      });
      return NextResponse.json({
        ok: true,
        existing: false,
        docNumber: inv.docNumber,
        invoiceUrl: invoiceUrl || null,
      });
    }

    // YaadPay path
    const provider = getProvider();
    if (!provider.getInvoiceUrl) {
      return NextResponse.json({ error: `הפקת חשבוניות אינה נתמכת בספק ${provider.name}` }, { status: 501 });
    }
    const { url } = await provider.getInvoiceUrl({
      providerTxId: body.transId,
      asmachta: body.asm,
      type: body.type || "HTML",
    });
    return NextResponse.json({ url });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
