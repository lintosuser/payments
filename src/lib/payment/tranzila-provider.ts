import {
  type TranzilaConfig,
  buildPaymentUrl,
  tokenCharge,
  refundTransaction,
  voidTransaction,
  commitTransaction,
  parseTranzilaResponse,
  isSuccess,
  getErrorMessage,
} from "@/lib/tranzila";
import type {
  ChargeTokenParams,
  NotifyData,
  PaymentLinkParams,
  PaymentProvider,
  PaymentResult,
  TxRefParams,
} from "./types";

// Tranzila's field naming varies between channels: the hosted-page redirect
// sends `expmonth` + `expyear` + `ccard` (last 4), while some legacy CGI
// responses use a combined `expdate` (MMYY) + `card`. Try the split fields
// first, fall back to the combined form.
function extractExpMonth(raw: Record<string, string>): string | undefined {
  return raw.expmonth || raw.expdate?.slice(0, 2) || undefined;
}
function extractExpYear(raw: Record<string, string>): string | undefined {
  return raw.expyear || raw.expdate?.slice(2) || undefined;
}
function extractLast4(raw: Record<string, string>): string {
  // `ccno` is the 4-digit last-four on the hosted-page callback; `ccard` and
  // `card` are used on other Tranzila channels — fall through in that order.
  return raw.ccno || raw.ccard || raw.card || "";
}

// The hosted iframe echoes back our request literal `TranzilaTK=create` in
// the response instead of the actual token — the real reusable token comes
// under `benid` (26+ chars) or `DclickTK` on some Tranzila terminals.
// Anything shorter than 10 chars, or literally "create", is not a real token.
function extractToken(raw: Record<string, string>): string | undefined {
  const candidates = [raw.TranzilaTK, raw.benid, raw.DclickTK];
  for (const c of candidates) {
    if (c && c !== "create" && c.length >= 10) return c;
  }
  return undefined;
}

function toResult(raw: Record<string, string>, opts: { postponedCode?: string } = {}): PaymentResult {
  const code = raw.Response || "";
  const success = isSuccess(code);
  return {
    success,
    postponed: opts.postponedCode ? code === opts.postponedCode : false,
    providerTxId: raw.index || "",
    responseCode: code,
    confirmationCode: raw.ConfirmationCode || "",
    last4: extractLast4(raw),
    brand: raw.cardtype || "",
    token: extractToken(raw),
    tokenExpMonth: extractExpMonth(raw),
    tokenExpYear: extractExpYear(raw),
    raw,
  };
}

function toNotify(raw: Record<string, string>): NotifyData {
  const code = raw.Response || "";
  return {
    success: isSuccess(code),
    providerTxId: raw.index || "",
    // `lintos_tx` is our internal reference, set as a custom URL param.
    // Older pending txs (before this rename) used Tranzila's `myid` field —
    // fall back to it for back-compat.
    myid: raw.lintos_tx || raw.myid || "",
    amount: Number(raw.sum) || 0,
    currency: Number(raw.currency) || 1,
    responseCode: code,
    confirmationCode: raw.ConfirmationCode || "",
    last4: extractLast4(raw),
    brand: raw.cardtype || "",
    description: raw.pdesc || "",
    token: extractToken(raw),
    tokenExpMonth: extractExpMonth(raw),
    tokenExpYear: extractExpYear(raw),
    raw,
  };
}

export class TranzilaProvider implements PaymentProvider {
  readonly name = "tranzila" as const;
  constructor(private readonly config: TranzilaConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.terminal && this.config.password);
  }

  publicId(): string {
    return this.config.terminal || "";
  }

  async createPaymentLink(params: PaymentLinkParams): Promise<{ paymentUrl: string }> {
    return { paymentUrl: buildPaymentUrl(this.config, params) };
  }

  async chargeToken(params: ChargeTokenParams): Promise<PaymentResult> {
    const raw = await tokenCharge(this.config, params) as unknown as Record<string, string>;
    // Tranzila uses "800" elsewhere as deferred — but its CGI doesn't return 800;
    // postponed=true is best inferred by tranmode=J on the request, not response.
    return toResult(raw);
  }

  async refund(p: TxRefParams): Promise<PaymentResult> {
    const raw = await refundTransaction(
      this.config,
      p.providerTxId,
      p.authNumber || "",
      p.token || "",
      p.expdate || "",
      p.amount,
      p.currency || 1,
    ) as unknown as Record<string, string>;
    return toResult(raw);
  }

  async cancel(p: TxRefParams): Promise<PaymentResult> {
    const raw = await voidTransaction(
      this.config,
      p.providerTxId,
      p.authNumber || "",
      p.token || "",
      p.expdate || "",
      p.amount,
    ) as unknown as Record<string, string>;
    return toResult(raw);
  }

  async commit(p: TxRefParams): Promise<PaymentResult> {
    const raw = await commitTransaction(
      this.config,
      p.providerTxId,
      p.authNumber || "",
      p.token || "",
      p.expdate || "",
      p.amount,
    ) as unknown as Record<string, string>;
    return toResult(raw);
  }

  parseRedirect(qs: string): NotifyData {
    return toNotify(parseTranzilaResponse(qs));
  }

  parseNotify(rawBody: string): NotifyData {
    return toNotify(parseTranzilaResponse(rawBody));
  }

  errorMessage(code: string): string {
    return getErrorMessage(code);
  }
}
