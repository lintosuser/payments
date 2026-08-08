// Tranzila Invoices API — create-document.
// Endpoint: POST https://billing5.tranzila.com/api/documents_db/create_document
// Docs: https://docs.tranzila.com/docs/invoices/invoices-api/create-document
//
// Auth (HMAC-SHA256) per https://docs.tranzila.com/docs/payments-and-billing/authentication
//   nonce = 80 hex chars (bin2hex of 40 random bytes)
//   time  = unix timestamp (seconds)
//   token = HMAC-SHA256(key = secret + time + nonce, message = appKey).hex()
//
// Env vars (server-side):
//   TRANZILA_APP_KEY
//   TRANZILA_SECRET
//   TRANZILA_TERMINAL  (reused from iframenew config)
//
// Response envelope (always HTTP 200; check status_code):
//   { status_code: 0, status_msg: "הצלחה", enquiry_key, document: { number, retrieval_key, ... } }
//   On failure: status_code != 0, status_msg = error message.

import crypto from "node:crypto";

interface DocsConfig {
  appKey: string;
  secret: string;
  terminal: string;
}

function getConfig(): DocsConfig | null {
  const appKey = process.env.TRANZILA_APP_KEY || "";
  const secret = process.env.TRANZILA_SECRET || "";
  const terminal = process.env.TRANZILA_TERMINAL || "";
  if (!appKey || !secret || !terminal) return null;
  return { appKey, secret, terminal };
}

function authHeaders(cfg: DocsConfig): Record<string, string> {
  const time = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(40).toString("hex"); // 80 hex chars
  // PHP: hash_hmac('sha256', $appKey, $secret . $time . $nonce)
  //      hash_hmac($algo, $data, $key) — so key = secret+time+nonce, data = appKey
  const hmacKey = cfg.secret + time + nonce;
  const token = crypto.createHmac("sha256", hmacKey).update(cfg.appKey).digest("hex");
  return {
    "X-tranzila-api-app-key": cfg.appKey,
    "X-tranzila-api-request-time": time,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": token,
    "Content-Type": "application/json",
  };
}

export interface InvoiceParams {
  clientName: string;
  clientEmail: string;
  description: string;
  amount: number;
  currency: "ILS" | "USD" | "EUR" | "GBP";
  /** Tranzila transaction id (their `index` field) — for correlation in their reports. */
  tranzilaIndex: string;
  cardLast4: string;
  /** Customer's ID / H.P. (optional but useful on the invoice). */
  clientId?: string;
  /** Defaults to IR (Tax Invoice + Receipt). RE=Receipt, DI=Deal Invoice, IN=Tax Invoice. */
  documentType?: "IR" | "RE" | "DI" | "IN";
}

export interface InvoiceResult {
  ok: boolean;
  docNumber?: string;
  enquiryKey?: string;
  retrievalKey?: string;
  error?: string;
  raw?: unknown;
}

export function isInvoicingConfigured(): boolean {
  return getConfig() !== null;
}

export async function createInvoiceReceipt(p: InvoiceParams): Promise<InvoiceResult> {
  const cfg = getConfig();
  if (!cfg) return { ok: false, error: "TRANZILA_APP_KEY/SECRET/TERMINAL not configured" };

  const docType = p.documentType || "IR";
  const docDate = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const last4Int = Number((p.cardLast4 || "").replace(/\D/g, "")) || 0;
  const txnIndex = Number((p.tranzilaIndex || "").replace(/\D/g, "")) || 0;

  const body = {
    terminal_name: cfg.terminal,
    document_date: docDate,
    document_type: docType,
    action: 1,                         // 1 = debit, 3 = credit
    document_language: p.currency === "ILS" ? "heb" : "eng",
    response_language: "heb",
    document_currency_code: p.currency,
    vat_percent: 17,
    client_name: p.clientName || "",
    client_email: p.clientEmail,
    ...(p.clientId ? { client_id: p.clientId } : {}),
    items: [{
      name: p.description || "תשלום",
      type: "I",                       // I = product/service
      unit_price: p.amount,
      units_number: 1,
      unit_type: 1,
      price_type: "G",                 // G = gross (VAT-inclusive)
      currency_code: p.currency,
    }],
    payments: [{
      payment_method: 1,               // 1 = credit card
      payment_date: docDate,
      amount: p.amount,
      currency_code: p.currency,
      ...(last4Int ? { cc_last_4_digits: last4Int } : {}),
      ...(txnIndex ? { txnindex: txnIndex } : {}),
    }],
    created_by_system: "lintos",
    ...(txnIndex ? { created_by_user: String(txnIndex) } : {}),
  };

  try {
    const res = await fetch("https://billing5.tranzila.com/api/documents_db/create_document", {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }

    if (!res.ok) {
      console.error("[invoice] HTTP", res.status, text.slice(0, 400));
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, raw: json ?? text };
    }

    const statusCode = json?.status_code;
    if (statusCode !== 0) {
      const msg = (json?.status_msg as string | undefined) ?? "unknown";
      console.error("[invoice] status_code", statusCode, "msg:", msg);
      return { ok: false, error: `status_code ${statusCode}: ${msg}`, raw: json };
    }

    const doc = (json?.document ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      docNumber: (doc.number as string | undefined) ?? (doc.id as string | undefined),
      enquiryKey: json?.enquiry_key as string | undefined,
      retrievalKey: doc.retrieval_key as string | undefined,
      raw: json,
    };
  } catch (e) {
    console.error("[invoice] error", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
