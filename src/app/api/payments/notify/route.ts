import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { dbExec, dbOne } from "@/lib/db";
import { createInvoiceReceipt, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { clientDisplayName } from "@/lib/client-name";
import { sendInvoiceEmail, isEmailConfigured } from "@/lib/email";

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const COIN_CODE: Record<number, "ILS" | "USD" | "EUR" | "GBP"> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

/**
 * Provider -> server-to-server notify callback. Public route (no session).
 *
 * Matching priority — first hit wins, no fall-through to looser strategies
 * once a match is found, so retries never create duplicate rows:
 *   1. yaad_id == providerTxId         (idempotency — already processed)
 *   2. id == lintos_tx (our GUID)      (the link generated this row)
 *   3. amount + recent (10 min)        (best-effort — only as last resort)
 *
 * Returns 200 even on internal DB errors so Tranzila stops the 5-min retry
 * storm; we've logged enough to reconcile manually.
 */
export async function POST(req: NextRequest) {
  const provider = getProvider();
  if (!provider.isConfigured()) return NextResponse.json({ ok: false }, { status: 500 });

  const raw = await req.text();
  const data = provider.parseNotify(raw);

  // Value LENGTHS only (never values) so we can see which fields are
  // present-but-empty vs. actually populated on Tranzila's callback.
  const lens: Record<string, number> = {};
  for (const [k, v] of Object.entries(data.raw)) {
    lens[k] = typeof v === "string" ? v.length : 0;
  }
  console.log("[notify] received", JSON.stringify({
    success: data.success,
    code: data.responseCode,
    providerTxId: data.providerTxId,
    myid: data.myid,
    amount: data.amount,
    hasToken: Boolean(data.token),
    hasExpMonth: Boolean(data.tokenExpMonth),
    hasLast4: Boolean(data.last4),
    lens,
  }));

  // Reject callbacks from terminals other than ours. Tranzila echoes `supplier`
  // in every notify body — this is the closest thing to a webhook signature it provides.
  const ourTerminal = process.env.TRANZILA_TERMINAL || "";
  const theirTerminal = (data.raw as Record<string, string>).supplier || "";
  if (ourTerminal && theirTerminal && theirTerminal !== ourTerminal) {
    console.warn("[notify] terminal mismatch — rejected", { got: theirTerminal, expected: ourTerminal });
    return NextResponse.json({ ok: false, reason: "invalid terminal" }, { status: 400 });
  }

  if (!data.success) {
    return NextResponse.json({ ok: false, reason: "not approved", code: data.responseCode }, { status: 400 });
  }
  if (!data.providerTxId) return NextResponse.json({ ok: true, ignored: "no provider tx id" });
  if (data.amount <= 0) {
    console.warn("[notify] rejected — non-positive amount", data.amount);
    return NextResponse.json({ ok: false, reason: "invalid amount" }, { status: 400 });
  }

  try {
    // 1) Idempotency: have we already recorded this providerTxId?
    const already = await dbOne<{ id: string; client_id: string | null; status: string }>`
      SELECT TOP 1 id, client_id, status FROM dbo.transactions
      WHERE yaad_id = ${data.providerTxId}`;
    if (already) {
      console.log("[notify] dup, already recorded", already.id);
      if (data.token && already.client_id) {
        await dbExec`
          UPDATE dbo.clients
          SET token = ${data.token},
              token_exp_month = ${data.tokenExpMonth || null},
              token_exp_year = ${data.tokenExpYear || null},
              l4digit = ${data.last4 || null}
          WHERE id = ${already.client_id}`;
      }
      return NextResponse.json({ ok: true, dedup: true });
    }

    let txClientId: string | null = null;
    let matchedRowId: string | null = null;
    let hkFreqMonths: number | null = null;
    let hkNextCharge: string | null = null;

    // 2) Match by our internal id passed via lintos_tx
    if (data.myid && GUID_RE.test(data.myid)) {
      const row = await dbOne<{ id: string; client_id: string | null; hk_freq_months: number | null; hk_next_charge: string | null }>`
        UPDATE dbo.transactions
        SET yaad_id = ${data.providerTxId}, status = 'approved',
            ccode = ${data.responseCode}, acode = ${data.confirmationCode},
            l4digit = ${data.last4}, brand = ${data.brand}
        OUTPUT inserted.id, inserted.client_id, inserted.hk_freq_months, inserted.hk_next_charge
        WHERE id = ${data.myid} AND status = 'pending'`;
      if (row) { matchedRowId = row.id; txClientId = row.client_id; hkFreqMonths = row.hk_freq_months; hkNextCharge = row.hk_next_charge; }
    }

    // 3) Fallback: most-recent pending with this amount in the last 10 minutes.
    //    Tight window prevents matching a different link generated long ago.
    if (!matchedRowId) {
      const row = await dbOne<{ id: string; client_id: string | null; hk_freq_months: number | null; hk_next_charge: string | null }>`
        UPDATE dbo.transactions
        SET yaad_id = ${data.providerTxId}, status = 'approved',
            ccode = ${data.responseCode}, acode = ${data.confirmationCode},
            l4digit = ${data.last4}, brand = ${data.brand}
        OUTPUT inserted.id, inserted.client_id, inserted.hk_freq_months, inserted.hk_next_charge
        WHERE id = (
          SELECT TOP 1 id FROM dbo.transactions
          WHERE status = 'pending' AND amount = ${data.amount}
            AND created_at > DATEADD(MINUTE, -10, SYSUTCDATETIME())
          ORDER BY created_at DESC
        )`;
      if (row) { matchedRowId = row.id; txClientId = row.client_id; hkFreqMonths = row.hk_freq_months; hkNextCharge = row.hk_next_charge; }
    }

    // 4) Last resort: insert a standalone approved row (no client linkage).
    if (!matchedRowId) {
      const row = await dbOne<{ client_id: string | null }>`
        INSERT INTO dbo.transactions (yaad_id, amount, coin, status, ccode, acode, info, l4digit, brand, type)
        OUTPUT inserted.client_id
        VALUES (${data.providerTxId}, ${data.amount}, ${data.currency}, 'approved',
                ${data.responseCode}, ${data.confirmationCode}, ${data.description},
                ${data.last4}, ${data.brand}, 'payment')`;
      txClientId = row?.client_id ?? null;
      console.log("[notify] inserted standalone row for", data.providerTxId);
    }

    // Save token onto the linked client, if we have both.
    if (data.token && txClientId) {
      await dbExec`
        UPDATE dbo.clients
        SET token = ${data.token},
            token_exp_month = ${data.tokenExpMonth || null},
            token_exp_year = ${data.tokenExpYear || null},
            l4digit = ${data.last4 || null}
        WHERE id = ${txClientId}`;
    }

    // Create subscription if this payment link was generated with hk=true.
    if (matchedRowId && txClientId && hkFreqMonths && hkNextCharge) {
      try {
        await dbExec`
          INSERT INTO dbo.subscriptions (client_id, amount, coin, info, freq_months, next_charge)
          VALUES (${txClientId}, ${data.amount}, ${data.currency}, ${data.description || "הוראת קבע"},
                  ${hkFreqMonths}, ${hkNextCharge})`;
        console.log("[notify] subscription created from payment link for client", txClientId);
      } catch (subErr) {
        console.error("[notify] subscription create failed:", subErr);
      }
    }

    // Fire the invoice/receipt to the customer's email, if we have a client.
    if (matchedRowId && txClientId && isInvoicingConfigured()) {
      const client = await dbOne<{
        business_name: string; first_name: string; last_name: string;
        email: string; user_id: string;
      }>`SELECT business_name, first_name, last_name, email, user_id FROM dbo.clients WHERE id = ${txClientId}`;
      if (client?.email) {
        const inv = await createInvoiceReceipt({
          clientName: clientDisplayName(client),
          clientEmail: client.email,
          clientId: client.user_id,
          description: data.description || "תשלום",
          amount: data.amount,
          currency: COIN_CODE[data.currency] || "ILS",
          tranzilaIndex: data.providerTxId,
          cardLast4: data.last4,
        });
        if (inv.ok && inv.docNumber) {
          const invoiceUrl = inv.retrievalKey
            ? `https://my.tranzila.com/api/get_financial_document/${inv.retrievalKey}`
            : "";
          await dbExec`
            UPDATE dbo.transactions
            SET hesh = ${inv.docNumber}, invoice_url = ${invoiceUrl}
            WHERE id = ${matchedRowId}`;

          if (invoiceUrl && isEmailConfigured()) {
            const COIN_SYM: Record<number, string> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };
            sendInvoiceEmail({
              to: client.email,
              clientName: clientDisplayName(client),
              docNumber: inv.docNumber,
              invoiceUrl,
              amount: data.amount,
              currency: COIN_SYM[data.currency] || "ILS",
              description: data.description || "תשלום",
              coin: data.currency,
            }).catch((err) => console.error("[notify] invoice email failed:", err));
          }
        } else if (!inv.ok) {
          console.error("[notify] invoice create failed:", inv.error);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[notify] DB error", e);
    return NextResponse.json({ ok: false, recorded: false, error: "internal" }, { status: 200 });
  }
}

export const GET = POST;
