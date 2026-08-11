import { NextRequest, NextResponse } from "next/server";
import { dbExec, dbOne } from "@/lib/db";
import { createInvoiceReceipt, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { clientDisplayName } from "@/lib/client-name";
import { sendInvoiceEmail, isEmailConfigured } from "@/lib/email";
import { dispatchInvoiceToBookkeeping } from "@/lib/bookkeeping";

/**
 * Called by the /pay/[code] page after Tranzila's Hosted Fields fields.charge()
 * returns a successful transaction. The browser posts:
 *   { code, transactionId, token, last4, expiryMonth, expiryYear,
 *     cardBrand, authNumber, responseCode }
 *
 * We match the pending transaction by short_code, flip it to approved, save
 * the token+expiry+last4 to the linked client, and (if it was an hk link)
 * create the subscription. Public route — the short_code is the auth.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    code, transactionId, token, last4,
    expiryMonth, expiryYear, cardBrand, authNumber, responseCode,
  } = body as Record<string, string | undefined>;
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  if (!token || token.length < 10) return NextResponse.json({ error: "invalid token" }, { status: 400 });
  if (responseCode !== "000" && responseCode !== "0000") {
    return NextResponse.json({ error: "not approved", responseCode }, { status: 400 });
  }

  const tx = await dbOne<{
    id: string; client_id: string | null; amount: number; coin: number; info: string;
    hk_freq_months: number | null; hk_next_charge: string | null; status: string;
  }>`
    SELECT id, client_id, amount, coin, info, hk_freq_months, hk_next_charge, status
    FROM dbo.transactions WHERE short_code = ${code}`;
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (tx.status !== "pending") {
    return NextResponse.json({ ok: true, dedup: true, status: tx.status });
  }

  await dbExec`
    UPDATE dbo.transactions
    SET yaad_id = ${transactionId || ""},
        status = 'approved',
        ccode = ${responseCode || ""},
        acode = ${authNumber || ""},
        l4digit = ${last4 || ""},
        brand = ${cardBrand || ""}
    WHERE id = ${tx.id}`;

  if (tx.client_id) {
    await dbExec`
      UPDATE dbo.clients
      SET token = ${token},
          token_exp_month = ${expiryMonth || null},
          token_exp_year = ${expiryYear || null},
          l4digit = ${last4 || null}
      WHERE id = ${tx.client_id}`;
  }

  if (tx.client_id && tx.hk_freq_months && tx.hk_next_charge) {
    try {
      await dbExec`
        INSERT INTO dbo.subscriptions (client_id, amount, coin, info, freq_months, next_charge)
        VALUES (${tx.client_id}, ${tx.amount}, ${tx.coin}, ${tx.info || "הוראת קבע"},
                ${tx.hk_freq_months}, ${tx.hk_next_charge})`;
    } catch (subErr) {
      console.error("[hf-complete] subscription create failed:", subErr);
    }
  }

  // Fire invoice email (non-blocking — errors don't break the payment success flow)
  if (tx.client_id && isInvoicingConfigured()) {
    (async () => {
      try {
        const client = await dbOne<{
          business_name: string; first_name: string; last_name: string;
          email: string; user_id: string;
        }>`SELECT business_name, first_name, last_name, email, user_id FROM dbo.clients WHERE id = ${tx.client_id}`;
        if (!client?.email) return;
        const COIN_CODE: Record<number, "ILS" | "USD" | "EUR" | "GBP"> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };
        const inv = await createInvoiceReceipt({
          clientName: clientDisplayName(client),
          clientEmail: client.email,
          clientId: client.user_id,
          description: tx.info || "תשלום",
          amount: tx.amount,
          currency: COIN_CODE[tx.coin] || "ILS",
          tranzilaIndex: transactionId || "",
          cardLast4: last4 || "",
        });
        if (inv.ok && inv.docNumber) {
          const invoiceUrl = inv.retrievalKey
            ? `https://my.tranzila.com/api/get_financial_document/${inv.retrievalKey}`
            : "";
          await dbExec`
            UPDATE dbo.transactions
            SET hesh = ${inv.docNumber}, invoice_url = ${invoiceUrl}
            WHERE id = ${tx.id}`;
          if (invoiceUrl) {
            await dispatchInvoiceToBookkeeping({
              txId: tx.id, invoiceUrl, docNumber: inv.docNumber,
              amount: tx.amount, currency: tx.coin, description: tx.info || "תשלום",
            });
          }
          if (invoiceUrl && isEmailConfigured()) {
            await sendInvoiceEmail({
              to: client.email,
              clientName: clientDisplayName(client),
              docNumber: inv.docNumber,
              invoiceUrl,
              amount: tx.amount,
              currency: COIN_CODE[tx.coin] || "ILS",
              description: tx.info || "תשלום",
              coin: tx.coin,
            });
          }
        }
      } catch (e) {
        console.error("[hf-complete] invoice/email error:", e);
      }
    })();
  }

  return NextResponse.json({ ok: true, txId: tx.id });
}
