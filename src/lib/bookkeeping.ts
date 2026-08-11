import { dbExec } from "@/lib/db";
import { downloadInvoicePdf, retrievalKeyFromUrl, isInvoicingConfigured } from "@/lib/tranzila-documents";
import { sendInvoiceToBookkeeping, isEmailConfigured } from "@/lib/email";
import { getBookkeepingSettings } from "@/lib/app-settings";

const COIN_CODE: Record<number, string> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

/**
 * Download an invoice PDF and forward it to the bookkeeping inbox, then mark
 * the transaction bk_sent=1. Safe to call fire-and-forget: swallows errors
 * (leaves bk_sent=0 so it can be retried manually from the עסקאות page).
 *
 * `currency` may be a numeric coin code (1-4) or an ISO string.
 */
export async function dispatchInvoiceToBookkeeping(opts: {
  txId: string;
  invoiceUrl: string;
  docNumber: string;
  amount: number;
  currency: number | string;
  description: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { txId, invoiceUrl, docNumber, amount, description } = opts;
  const currency = typeof opts.currency === "number" ? (COIN_CODE[opts.currency] || "ILS") : opts.currency;

  if (!isInvoicingConfigured()) return { ok: false, error: "invoicing not configured" };
  if (!isEmailConfigured()) return { ok: false, error: "SMTP not configured" };
  const retrievalKey = retrievalKeyFromUrl(invoiceUrl);
  if (!retrievalKey) return { ok: false, error: "no invoice retrieval key" };

  try {
    const pdf = await downloadInvoicePdf(retrievalKey);
    if (!pdf) return { ok: false, error: "invoice PDF download failed" };
    const bk = await getBookkeepingSettings();
    await sendInvoiceToBookkeeping({
      docNumber, amount, currency, description, pdf,
      businessName: bk.businessName, businessHp: bk.businessHp, to: bk.email, cc: bk.cc,
    });
    await dbExec`UPDATE dbo.transactions SET bk_sent = 1, bk_sent_at = SYSUTCDATETIME() WHERE id = ${txId}`;
    return { ok: true };
  } catch (e) {
    console.error("[bookkeeping] dispatch failed for", txId, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
