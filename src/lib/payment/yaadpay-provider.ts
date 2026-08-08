import {
  type YaadPayConfig,
  apiSign,
  buildPaymentUrl as buildYaadUrl,
  softCharge,
  refundTransaction as yaadRefund,
  cancelTransaction as yaadCancel,
  commitTransaction as yaadCommit,
  changeHKStatus,
  getInvoiceUrl as yaadInvoiceUrl,
  parseYaadResponse,
  isSuccess as yaadSuccess,
  getErrorMessage as yaadErr,
} from "@/lib/yaadpay";
import type {
  ChargeTokenParams,
  InvoiceParams,
  NotifyData,
  PaymentLinkParams,
  PaymentProvider,
  PaymentResult,
  TxRefParams,
} from "./types";

function nameParts(contact: string): { first: string; last: string } {
  const [first, ...rest] = (contact || "").trim().split(/\s+/);
  return { first: first || "", last: rest.join(" ") };
}

function toResult(raw: Record<string, string>, postponedCode = "800"): PaymentResult {
  const code = raw.CCode || "";
  return {
    success: yaadSuccess(code),
    postponed: code === postponedCode,
    providerTxId: raw.Id || "",
    responseCode: code,
    confirmationCode: raw.ACode || "",
    last4: raw.L4digit || "",
    brand: raw.Brand || "",
    token: raw.Token,
    tokenExpMonth: raw.Tmonth,
    tokenExpYear: raw.Tyear,
    raw,
  };
}

function toNotify(raw: Record<string, string>): NotifyData {
  return {
    success: yaadSuccess(raw.CCode || ""),
    providerTxId: raw.Id || "",
    myid: raw.Order || raw.Fild1 || "",
    amount: Number(raw.Amount) || 0,
    currency: Number(raw.Coin) || 1,
    responseCode: raw.CCode || "",
    confirmationCode: raw.ACode || "",
    last4: raw.L4digit || "",
    brand: raw.Brand || "",
    description: raw.Info || "",
    raw,
  };
}

export class YaadpayProvider implements PaymentProvider {
  readonly name = "yaadpay" as const;
  constructor(private readonly config: YaadPayConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.masof && this.config.passP && this.config.key);
  }

  publicId(): string {
    return this.config.masof || "";
  }

  async createPaymentLink(params: PaymentLinkParams): Promise<{ paymentUrl: string }> {
    const { first, last } = nameParts(params.contact || "");
    const signed = await apiSign(this.config, {
      amount: params.amount,
      info: params.info,
      clientName: first,
      clientLName: last,
      userId: params.customerId || "0",
      email: params.email || "",
      phone: params.phone || "",
      cell: params.phone || "",
      order: params.myid,
      tash: params.tash,
      coin: params.currency,
      pageLang: "HEB",
    });
    return { paymentUrl: buildYaadUrl(signed) };
  }

  async chargeToken(params: ChargeTokenParams): Promise<PaymentResult> {
    const { first, last } = nameParts(params.contact);
    const raw = await softCharge(this.config, {
      token: params.token,
      tmonth: params.expdate.slice(0, 2),
      tyear: params.expdate.slice(2),
      amount: params.amount,
      info: params.info,
      userId: "0",
      clientName: first,
      clientLName: last,
      email: params.email,
      phone: params.phone,
      cell: params.phone,
      tash: params.tash,
      coin: params.currency,
      postpone: params.postpone,
      j5: params.postpone || undefined,
    }) as unknown as Record<string, string>;
    return toResult(raw);
  }

  async refund(p: TxRefParams): Promise<PaymentResult> {
    const raw = await yaadRefund(this.config, p.providerTxId, p.amount);
    return toResult(raw);
  }

  async cancel(p: TxRefParams): Promise<PaymentResult> {
    const raw = await yaadCancel(this.config, p.providerTxId);
    return toResult(raw);
  }

  async commit(p: TxRefParams): Promise<PaymentResult> {
    const raw = await yaadCommit(this.config, p.providerTxId);
    return toResult(raw);
  }

  parseRedirect(qs: string): NotifyData {
    return toNotify(parseYaadResponse(qs));
  }

  parseNotify(rawBody: string): NotifyData {
    return toNotify(parseYaadResponse(rawBody));
  }

  errorMessage(code: string): string {
    return yaadErr(code);
  }

  async getInvoiceUrl(params: InvoiceParams): Promise<{ url: string }> {
    const url = await yaadInvoiceUrl(this.config, {
      transId: params.providerTxId,
      asm: params.asmachta,
      type: params.type,
    });
    return { url };
  }

  async changeSubscriptionStatus(id: string, active: boolean): Promise<Record<string, string>> {
    return changeHKStatus(this.config, id, active ? 2 : 1);
  }
}
