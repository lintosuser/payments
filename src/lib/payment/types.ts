// Provider-agnostic payment types.
// Currency: 1=ILS, 2=USD, 3=EUR, 4=GBP (matches Tranzila + YaadPay encoding).

export type ProviderName = "tranzila" | "yaadpay";

export interface PaymentLinkParams {
  amount: number;
  info: string;
  currency?: 1 | 2 | 3 | 4;
  tash?: number;
  email?: string;
  phone?: string;
  contact?: string;
  /** Our internal transaction reference; echoed back on notify but never shown
   * to the customer. Use this to correlate the notify with our DB row. */
  myid?: string;
  /** Customer's national ID / company number — pre-fills the corresponding
   * field on the hosted payment page (Tranzila `myid`, YaadPay `UserId`). */
  customerId?: string;
  /** Ask the provider to create + return a reusable token in the notify body. */
  tokenize?: boolean;
  successUrl: string;
  failUrl: string;
  notifyUrl: string;
}

export interface ChargeTokenParams {
  token: string;
  expdate: string; // MMYY
  amount: number;
  info: string;
  contact: string;
  email?: string;
  phone?: string;
  currency?: 1 | 2 | 3 | 4;
  tash?: number;
  postpone?: boolean; // J / J5 — authorise without capture
}

export interface TxRefParams {
  // Identifies a prior transaction at the provider.
  providerTxId: string; // Tranzila index / YaadPay transId
  authNumber?: string;  // Tranzila authnr / YaadPay ACode
  token?: string;
  expdate?: string;
  amount: number;
  currency?: 1 | 2 | 3 | 4;
}

// Normalised result for any provider operation.
export interface PaymentResult {
  success: boolean;
  postponed?: boolean;        // J5 / 800 — approved but not captured
  providerTxId: string;       // index / Id
  responseCode: string;       // raw provider code (e.g. "000", "0")
  confirmationCode: string;   // authnr / ACode
  last4: string;
  brand: string;
  token?: string;             // returned by create-link flows when tokenize=true
  tokenExpMonth?: string;
  tokenExpYear?: string;
  raw: Record<string, string>;
}

export interface NotifyData {
  success: boolean;
  providerTxId: string;       // echoed transaction id
  myid: string;               // our internal id (echoed back)
  amount: number;
  currency: number;
  responseCode: string;
  confirmationCode: string;
  last4: string;
  brand: string;
  description: string;
  token?: string;
  tokenExpMonth?: string;
  tokenExpYear?: string;
  raw: Record<string, string>;
}

export interface InvoiceParams {
  providerTxId?: string;
  asmachta?: string;            // YaadPay-specific
  type: "HTML" | "PDF" | "NEW";
}

export interface PaymentProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  /** Public terminal/masof identifier (safe to surface in UI). */
  publicId(): string;

  createPaymentLink(params: PaymentLinkParams): Promise<{ paymentUrl: string }>;
  chargeToken(params: ChargeTokenParams): Promise<PaymentResult>;
  refund(params: TxRefParams): Promise<PaymentResult>;
  cancel(params: TxRefParams): Promise<PaymentResult>;
  commit(params: TxRefParams): Promise<PaymentResult>;

  /** Parse the query string from the customer's success/fail redirect. */
  parseRedirect(qs: string): NotifyData;
  /** Parse the server-to-server notify body. */
  parseNotify(rawBody: string): NotifyData;

  /** Localised human error for a provider response code. */
  errorMessage(code: string): string;

  // Optional capabilities — providers without them return 501.
  getInvoiceUrl?(params: InvoiceParams): Promise<{ url: string }>;
  /** Subscription / standing order state change (e.g. YaadPay HK). */
  changeSubscriptionStatus?(id: string, active: boolean): Promise<Record<string, string>>;
}
