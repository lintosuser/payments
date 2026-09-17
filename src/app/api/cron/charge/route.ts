import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getProvider } from "@/lib/payment";
import { buildExpdate } from "@/lib/tranzila";
import { db, dbExec, dbOne } from "@/lib/db";
import { createInvoiceReceipt, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { dispatchInvoiceToBookkeeping } from "@/lib/bookkeeping";
import { logAudit, getIp } from "@/lib/audit";

function safeCompare(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a), bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch { return false; }
}

const COIN_CODE: Record<number, "ILS" | "USD" | "EUR" | "GBP"> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

interface DueSub {
  id: string; client_id: string; amount: number; coin: number; info: string;
  freq_months: number;
  token: string; token_exp_month: string; token_exp_year: string;
  l4digit: string | null; email: string; client_name: string;
}

/**
 * POST /api/cron/charge
 * Called daily by the Windows Scheduled Task.
 * Protected by X-Cron-Secret header — NOT by session cookie.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!secret || !safeCompare(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const provider = getProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "payment provider not configured" }, { status: 500 });
  }

  const due = await db<DueSub>`
    SELECT s.id, s.client_id, s.amount, s.coin, s.info, s.freq_months,
           c.token, c.token_exp_month, c.token_exp_year, c.l4digit,
           c.email,
           COALESCE(NULLIF(LTRIM(RTRIM(c.business_name)), ''),
             LTRIM(RTRIM(c.first_name + N' ' + c.last_name))) AS client_name
    FROM dbo.subscriptions s
    JOIN dbo.clients c ON c.id = s.client_id
    WHERE s.active = 1
      AND s.next_charge <= CAST(SYSUTCDATETIME() AS DATE)
      AND c.token IS NOT NULL AND c.token <> ''`;

  const results: { id: string; client: string; ok: boolean; error?: string }[] = [];

  for (const sub of due) {
    try {
      const expdate = buildExpdate(sub.token_exp_month || "", sub.token_exp_year || "");
      console.log("[cron/charge] attempting sub", sub.id, JSON.stringify({
        hasToken: Boolean(sub.token), tokenLen: sub.token?.length || 0,
        expdate, amount: sub.amount, currency: sub.coin,
      }));
      const result = await provider.chargeToken({
        token: sub.token,
        expdate,
        amount: sub.amount,
        info: sub.info,
        contact: sub.client_name,
        email: sub.email,
        currency: sub.coin as 1 | 2 | 3 | 4,
      });
      console.log("[cron/charge] Tranzila response for sub", sub.id, JSON.stringify({
        success: result.success, code: result.responseCode, conf: result.confirmationCode,
        txId: result.providerTxId, rawKeys: Object.keys(result.raw),
      }));

      const status = result.success ? "approved" : "failed";

      await dbExec`
        INSERT INTO dbo.transactions (yaad_id, client_id, amount, coin, status, ccode, acode, info, hesh, type, l4digit, brand)
        VALUES (${result.providerTxId || ''}, ${sub.client_id}, ${sub.amount}, ${sub.coin},
                ${status}, ${result.responseCode || ''}, ${result.confirmationCode || ''},
                ${sub.info}, '', 'subscription', ${result.last4 || sub.l4digit || ''}, ${result.brand || ''})`;

      if (result.success) {
        // Advance next_charge by freq_months
        await dbExec`
          UPDATE dbo.subscriptions
          SET next_charge = DATEADD(MONTH, ${sub.freq_months}, next_charge)
          WHERE id = ${sub.id}`;

        // Auto-invoice
        if (isInvoicingConfigured() && sub.email) {
          try {
            const inv = await createInvoiceReceipt({
              clientName: sub.client_name,
              clientEmail: sub.email,
              description: sub.info,
              amount: sub.amount,
              currency: COIN_CODE[sub.coin] || "ILS",
              tranzilaIndex: result.providerTxId || "",
              cardLast4: result.last4 || sub.l4digit || "",
            });
            if (inv.ok && inv.docNumber) {
              const invoiceUrl = inv.retrievalKey
                ? `https://my.tranzila.com/api/get_financial_document/${inv.retrievalKey}`
                : "";
              const updated = await dbOne<{ id: string }>`
                UPDATE dbo.transactions
                SET hesh = ${inv.docNumber}, invoice_url = ${invoiceUrl}
                OUTPUT inserted.id
                WHERE yaad_id = ${result.providerTxId || ''} AND client_id = ${sub.client_id}`;
              if (updated?.id && invoiceUrl) {
                await dispatchInvoiceToBookkeeping({
                  txId: updated.id, invoiceUrl, docNumber: inv.docNumber,
                  amount: sub.amount, currency: sub.coin, description: sub.info,
                });
              }
            }
          } catch (invErr) {
            console.error("[cron/charge] invoice error for sub", sub.id, invErr);
          }
        }
      } else {
        // Advance next_charge on failure too, so a declined card is retried
        // only ONCE per cycle — not hammered every single day. The failed
        // transaction row + עסקאות indicator surface it for manual follow-up.
        await dbExec`
          UPDATE dbo.subscriptions
          SET next_charge = DATEADD(MONTH, ${sub.freq_months}, next_charge)
          WHERE id = ${sub.id}`;
        console.warn("[cron/charge] charge failed for sub", sub.id, result.responseCode, "- next_charge advanced");
      }

      results.push({ id: sub.id, client: sub.client_name, ok: result.success });
    } catch (e) {
      console.error("[cron/charge] error for sub", sub.id, e);
      results.push({ id: sub.id, client: sub.client_name, ok: false, error: String(e) });
    }
  }

  console.log(`[cron/charge] processed ${due.length} subscriptions:`, results);

  await logAudit({
    user: { id: undefined, email: "cron" },
    action: "cron.charge_run",
    ip: getIp(req),
    details: { processed: due.length, ok: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length },
  });

  return NextResponse.json({ ok: true, processed: due.length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
