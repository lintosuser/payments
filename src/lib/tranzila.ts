const TRANZILA_BASE = "https://direct.tranzila.com";
// Server-to-server tokenized charges go to this CGI endpoint — verified
// against a working sibling project on the same server. Newer Tranzila API
// v2 docs suggest tranzila31tk.cgi, but that path returns "Transactions are
// not allowed from this location" for our terminal; tranzila71u.cgi is what
// actually works and accepts the same TranzilaTK+expdate+TranzilaPW payload.
const TRANZILA_CGI = "https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi";

export interface TranzilaConfig {
  /** Terminal used for the customer-facing hosted iframe (iframenew.php). */
  terminal: string;
  password: string;
  /** Companion terminal provisioned for server-to-server token charges (the
   * `*2tok` / `*tok` variant that Tranzila creates alongside a hosted-page
   * terminal). Falls back to `terminal` when unset. */
  tokenTerminal?: string;
  tokenPassword?: string;
}

export interface PaymentLinkParams {
  amount: number;
  info: string;
  currency?: 1 | 2 | 3 | 4;
  tash?: number;
  email?: string;
  phone?: string;
  contact?: string;
  tokenize?: boolean;
  successUrl: string;
  failUrl: string;
  notifyUrl: string;
  /** Echoed back to notify but not displayed on Tranzila's form. */
  myid?: string;
  /** Customer's ID — fills Tranzila's "myid" input on the hosted form. */
  customerId?: string;
}

export interface TokenChargeParams {
  token: string;
  expdate: string; // MMYY
  amount: number;
  info: string;
  contact: string;
  email?: string;
  phone?: string;
  currency?: 1 | 2 | 3 | 4;
  tash?: number;
  postpone?: boolean;
}

export interface TranzilaResult {
  Response: string;
  ConfirmationCode: string;
  index: string;
  TranzilaTK?: string;
  expdate?: string;
  cardtype?: string;
  card?: string;
  errMsg?: string;
  sum?: string;
  currency?: string;
  myid?: string;
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); }
  catch { return s; }
}

export function parseTranzilaResponse(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of text.split("&")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = safeDecode(pair.slice(0, idx));
    const val = safeDecode(pair.slice(idx + 1));
    if (key) params[key] = val;
  }
  return params;
}

export function isSuccess(response: string): boolean {
  return response === "000";
}

export function getErrorMessage(code: string): string {
  const errors: Record<string, string> = {
    "000": "בוצע בהצלחה",
    "001": "כרטיס חסום",
    "002": "כרטיס גנוב",
    "003": "פנה למנפיק הכרטיס",
    "004": "כרטיס נדחה",
    "005": "כרטיס נדחה",
    "006": "כרטיס פג תוקף",
    "007": "CVV שגוי",
    "008": "אין יתרה מספיקה",
    "010": "סכום חלקי אושר",
    "033": "כרטיס פג תוקף",
    "036": "כרטיס מוגבל",
    "041": "כרטיס אבוד",
    "043": "כרטיס גנוב",
    "051": "אין יתרה מספיקה",
    "054": "כרטיס פג תוקף",
    "057": "פעולה לא מורשית",
    "062": "כרטיס מוגבל",
    "065": "חריגה ממגבלה",
    "091": "מנפיק לא זמין",
    "096": "שגיאת מערכת",
  };
  return errors[code] || `עסקה נכשלה (קוד: ${code})`;
}

export function getCoinLabel(coin: number): string {
  const coins: Record<number, string> = { 1: "ILS (₪)", 2: "USD ($)", 3: "EUR (€)", 4: "GBP (£)" };
  return coins[coin] || "ILS (₪)";
}

export function getCoinSymbol(coin: number): string {
  const symbols: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };
  return symbols[coin] || "₪";
}

// Parse MMYY expdate into separate parts
export function parseExpdate(expdate: string): { month: string; year: string } {
  return { month: expdate.slice(0, 2), year: expdate.slice(2) };
}

// Build MMYY expdate from token_exp_month + token_exp_year stored in DB
export function buildExpdate(month: string, year: string): string {
  const m = month.padStart(2, "0");
  const y = year.length === 4 ? year.slice(2) : year.padStart(2, "0");
  return m + y;
}

// Build iframe/redirect payment URL
export function buildPaymentUrl(config: TranzilaConfig, params: PaymentLinkParams): string {
  const p = new URLSearchParams();
  p.set("sum", params.amount.toFixed(2));
  p.set("currency", (params.currency || 1).toString());
  p.set("pdesc", params.info);
  if (params.tash && params.tash > 1) {
    p.set("cred_type", "6");
    p.set("npay", params.tash.toString());
    p.set("fpay", "1");
  } else {
    p.set("cred_type", "1");
  }
  if (params.email) p.set("email", params.email);
  if (params.phone) p.set("phone", params.phone);
  if (params.contact) p.set("contact", params.contact);
  // Tranzila's `myid` is the customer ID input on the hosted form. Pre-fill
  // it with the customer's real ID/H.P. when we know it.
  if (params.customerId) p.set("myid", params.customerId);
  // Our internal tx reference — Tranzila echoes unknown params back into the
  // notify body; this one isn't a form field so it stays invisible.
  if (params.myid) p.set("lintos_tx", params.myid);
  // Ask Tranzila to create a reusable token; returned as TranzilaTK in notify+redirect.
  // We never see the PAN/CVV — only the opaque TK and the last 4 digits.
  if (params.tokenize) p.set("TranzilaTK", "create");
  p.set("success_url_address", params.successUrl);
  p.set("fail_url_address", params.failUrl);
  p.set("notify_url_address", params.notifyUrl);
  p.set("lang", "il");
  return `${TRANZILA_BASE}/${config.terminal}/iframenew.php?${p.toString()}`;
}

async function postCharge(config: TranzilaConfig, body: URLSearchParams): Promise<TranzilaResult> {
  // Server-to-server charges must go to the token-terminal (e.g. lintos2tok),
  // not the hosted-page terminal (lintos). Rewrite `supplier` and, if a
  // separate token-terminal password is configured, the password too.
  if (config.tokenTerminal) {
    body.set("supplier", config.tokenTerminal);
    if (config.tokenPassword) {
      body.set("TranPassword", config.tokenPassword);
    }
  }
  // The CGI endpoint expects `TranzilaPW`; mirror `TranPassword` into it so
  // callers only need to set one of them.
  if (body.has("TranPassword") && !body.has("TranzilaPW")) {
    body.set("TranzilaPW", body.get("TranPassword")!);
  }
  const res = await fetch(TRANZILA_CGI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (text.trim().startsWith("<")) {
    // Strip HTML tags to surface just the human-readable Tranzila alert text.
    const stripped = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    console.error(`[tranzila.postCharge] non-KV response from ${TRANZILA_CGI} (status=${res.status}): ${stripped.slice(0, 800)}`);
  }
  return parseTranzilaResponse(text) as unknown as TranzilaResult;
}

export async function tokenCharge(config: TranzilaConfig, params: TokenChargeParams): Promise<TranzilaResult> {
  const p = new URLSearchParams();
  p.set("supplier", config.terminal);
  p.set("TranPassword", config.password);
  p.set("sum", params.amount.toFixed(2));
  p.set("currency", (params.currency || 1).toString());
  p.set("TranzilaTK", params.token);
  p.set("expdate", params.expdate);
  if (params.tash && params.tash > 1) {
    p.set("cred_type", "6");
    p.set("npay", params.tash.toString());
    p.set("fpay", "1");
  } else {
    p.set("cred_type", "1");
  }
  p.set("tranmode", params.postpone ? "J" : "A");
  p.set("contact", params.contact);
  if (params.email) p.set("email", params.email);
  if (params.phone) p.set("phone", params.phone);
  if (params.info) p.set("myid", params.info);
  return postCharge(config, p);
}

export async function refundTransaction(
  config: TranzilaConfig,
  index: string,
  authnr: string,
  token: string,
  expdate: string,
  amount: number,
  currency = 1,
): Promise<TranzilaResult> {
  const p = new URLSearchParams();
  p.set("supplier", config.terminal);
  p.set("TranPassword", config.password);
  p.set("sum", amount.toFixed(2));
  p.set("currency", currency.toString());
  p.set("TranzilaTK", token);
  p.set("expdate", expdate);
  p.set("cred_type", "1");
  p.set("tranmode", "C");
  p.set("authnr", authnr);
  p.set("index", index);
  return postCharge(config, p);
}

export async function voidTransaction(
  config: TranzilaConfig,
  index: string,
  authnr: string,
  token: string,
  expdate: string,
  amount: number,
): Promise<TranzilaResult> {
  const p = new URLSearchParams();
  p.set("supplier", config.terminal);
  p.set("TranPassword", config.password);
  p.set("sum", amount.toFixed(2));
  p.set("currency", "1");
  p.set("TranzilaTK", token);
  p.set("expdate", expdate);
  p.set("tranmode", "V");
  p.set("authnr", authnr);
  p.set("index", index);
  return postCharge(config, p);
}

export async function commitTransaction(
  config: TranzilaConfig,
  index: string,
  authnr: string,
  token: string,
  expdate: string,
  amount: number,
): Promise<TranzilaResult> {
  const p = new URLSearchParams();
  p.set("supplier", config.terminal);
  p.set("TranPassword", config.password);
  p.set("sum", amount.toFixed(2));
  p.set("currency", "1");
  p.set("TranzilaTK", token);
  p.set("expdate", expdate);
  p.set("cred_type", "1");
  p.set("tranmode", "F");
  p.set("authnr", authnr);
  p.set("index", index);
  return postCharge(config, p);
}
