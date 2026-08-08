// YaadPay API Client
// Base URL for all API calls
const YAADPAY_BASE = "https://icom.yaad.net/p/";
const YAADPAY_CGI = "https://icom.yaad.net/cgi-bin/yaadpay/yaadpay3ds.pl";

export interface YaadPayConfig {
  masof: string;
  passP: string;
  key: string;
}

export interface PaymentParams {
  clientName: string;
  clientLName: string;
  userId: string;
  email: string;
  phone: string;
  cell: string;
  amount: number;
  info: string;
  order?: string;
  street?: string;
  city?: string;
  zip?: string;
  tash?: number;
  coin?: 1 | 2 | 3 | 4; // 1=ILS, 2=USD, 3=EUR, 4=GBP
  postpone?: boolean;
  j5?: boolean;
  sendHesh?: boolean;
  heshDesc?: string;
  pritim?: boolean;
  sendemail?: boolean;
  hk?: boolean;
  freq?: number;
  firstDate?: string;
  onlyOnApprove?: boolean;
  tmp?: number;
  pageLang?: "HEB" | "ENG";
}

export interface SoftChargeParams {
  token: string;
  tmonth: string;
  tyear: string;
  amount: number;
  info: string;
  userId: string;
  clientName: string;
  clientLName?: string;
  email?: string;
  phone?: string;
  cell?: string;
  street?: string;
  city?: string;
  zip?: string;
  tash?: number;
  coin?: 1 | 2 | 3 | 4;
  order?: string;
  sendHesh?: boolean;
  heshDesc?: string;
  pritim?: boolean;
  sendemail?: boolean;
  postpone?: boolean;
  j5?: boolean | "J2";
}

export interface TransactionResult {
  Id: string;
  CCode: string;
  Amount: string;
  ACode: string;
  Fild1?: string;
  Fild2?: string;
  Fild3?: string;
  Bank?: string;
  Payments?: string;
  UserId?: string;
  Brand?: string;
  Issuer?: string;
  L4digit?: string;
  Coin?: string;
  Tmonth?: string;
  Tyear?: string;
  Hesh?: string;
  HKId?: string;
  errMsg?: string;
  UID?: string;
}

export interface TokenResult {
  Id: string;
  CCode: string;
  Token: string;
  Tokef: string; // YYMM
  Fild1?: string;
  Fild2?: string;
  Fild3?: string;
}

// Parse YaadPay response (URL-encoded key=value pairs)
export function parseYaadResponse(response: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = response.split("&");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    params[key] = decodeURIComponent(valueParts.join("=").replace(/\+/g, " "));
  }
  return params;
}

// Check if response is successful
export function isSuccess(ccode: string): boolean {
  return ccode === "0";
}

// Get error description
export function getErrorMessage(ccode: string): string {
  const errors: Record<string, string> = {
    "0": "Success",
    "33": "Refund amount exceeds original transaction",
    "250": "Deal doesn't exist or already committed",
    "400": "Sum of items differs from transaction amount",
    "401": "First or last name required",
    "402": "Deal information required",
    "600": "Card details check (J2)",
    "700": "Approved without charge (J5)",
    "800": "Postponed charge",
    "901": "Terminal not permitted for this method",
    "902": "Authentication error",
    "903": "Max payments exceeded",
    "905": "Wrong parameter value",
    "906": "Agreement doesn't exist",
    "910": "Token request from invalid transaction",
    "920": "Deal doesn't exist or already committed",
    "990": "Card details not fully readable",
    "996": "Terminal not permitted to use token",
    "997": "Invalid token",
    "998": "Deal cancelled",
    "999": "Communication error",
  };
  return errors[ccode] || `Unknown error (code: ${ccode})`;
}

// Get coin label
export function getCoinLabel(coin: number): string {
  const coins: Record<number, string> = {
    1: "ILS (₪)",
    2: "USD ($)",
    3: "EUR (€)",
    4: "GBP (£)",
  };
  return coins[coin] || "ILS (₪)";
}

export function getCoinSymbol(coin: number): string {
  const symbols: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };
  return symbols[coin] || "₪";
}

// Get brand name
export function getBrandName(brand: string): string {
  const brands: Record<string, string> = {
    "0": "PL",
    "1": "MasterCard",
    "2": "Visa",
    "3": "Diners",
    "4": "Amex",
    "5": "Isracard",
  };
  return brands[brand] || brand;
}

// Get bank/issuer name
export function getBankName(bank: string): string {
  const banks: Record<string, string> = {
    "1": "Isracard",
    "2": "Visa Cal",
    "3": "Diners",
    "4": "Amex",
    "6": "Leumi Card",
    "99": "BIT",
  };
  return banks[bank] || bank;
}

// Step 1: APISign - Sign parameters for payment page
export async function apiSign(
  config: YaadPayConfig,
  params: PaymentParams
): Promise<string> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "APISign");
  queryParams.set("What", "SIGN");
  queryParams.set("Masof", config.masof);
  queryParams.set("KEY", config.key);
  queryParams.set("PassP", config.passP);
  queryParams.set("Amount", params.amount.toString());
  queryParams.set("Info", params.info);
  queryParams.set("ClientName", params.clientName);
  queryParams.set("ClientLName", params.clientLName);
  queryParams.set("UserId", params.userId);
  queryParams.set("email", params.email);
  queryParams.set("phone", params.phone);
  queryParams.set("cell", params.cell);
  queryParams.set("UTF8", "True");
  queryParams.set("UTF8out", "True");
  queryParams.set("Sign", "True");
  queryParams.set("MoreData", "True");

  if (params.order) queryParams.set("Order", params.order);
  if (params.street) queryParams.set("street", params.street);
  if (params.city) queryParams.set("city", params.city);
  if (params.zip) queryParams.set("zip", params.zip);
  if (params.tash) queryParams.set("Tash", params.tash.toString());
  if (params.coin) queryParams.set("Coin", params.coin.toString());
  if (params.postpone) queryParams.set("Postpone", "True");
  if (params.j5) queryParams.set("J5", "True");
  if (params.sendHesh) queryParams.set("SendHesh", "True");
  if (params.heshDesc) queryParams.set("heshDesc", params.heshDesc);
  if (params.pritim) queryParams.set("Pritim", "True");
  if (params.sendemail) queryParams.set("sendemail", "True");
  if (params.tmp) queryParams.set("tmp", params.tmp.toString());
  if (params.pageLang) queryParams.set("PageLang", params.pageLang);
  if (params.hk) {
    queryParams.set("HK", "True");
    if (params.freq) queryParams.set("freq", params.freq.toString());
    if (params.firstDate) queryParams.set("FirstDate", params.firstDate);
    if (params.onlyOnApprove) queryParams.set("OnlyOnApprove", "True");
  }

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return text; // Returns signed parameters including signature
}

// Build payment page URL from signed response
export function buildPaymentUrl(signedResponse: string): string {
  return `${YAADPAY_BASE}?${signedResponse}`;
}

// Step 4: Verify transaction
export async function verifyTransaction(
  config: YaadPayConfig,
  successParams: string
): Promise<Record<string, string>> {
  const url = `${YAADPAY_BASE}?action=APISign&What=VERIFY&KEY=${config.key}&PassP=${config.passP}&Masof=${config.masof}&${successParams}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text);
}

// Soft Protocol - Charge with token
export async function softCharge(
  config: YaadPayConfig,
  params: SoftChargeParams
): Promise<TransactionResult> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "soft");
  queryParams.set("Masof", config.masof);
  queryParams.set("PassP", config.passP);
  queryParams.set("Amount", params.amount.toString());
  queryParams.set("CC", params.token);
  queryParams.set("Tmonth", params.tmonth);
  queryParams.set("Tyear", params.tyear);
  queryParams.set("Info", params.info);
  queryParams.set("UserId", params.userId);
  queryParams.set("ClientName", params.clientName);
  queryParams.set("Token", "True");
  queryParams.set("UTF8", "True");
  queryParams.set("UTF8out", "True");
  queryParams.set("MoreData", "True");

  if (params.clientLName) queryParams.set("ClientLName", params.clientLName);
  if (params.email) queryParams.set("email", params.email);
  if (params.phone) queryParams.set("phone", params.phone);
  if (params.cell) queryParams.set("cell", params.cell);
  if (params.street) queryParams.set("street", params.street);
  if (params.city) queryParams.set("city", params.city);
  if (params.zip) queryParams.set("zip", params.zip);
  if (params.tash) queryParams.set("Tash", params.tash.toString());
  if (params.coin) queryParams.set("Coin", params.coin.toString());
  if (params.order) queryParams.set("Order", params.order);
  if (params.sendHesh) queryParams.set("SendHesh", "True");
  if (params.heshDesc) queryParams.set("heshDesc", params.heshDesc);
  if (params.pritim) queryParams.set("Pritim", "True");
  if (params.sendemail) queryParams.set("sendemail", "True");
  if (params.postpone) queryParams.set("Postpone", "True");
  if (params.j5) queryParams.set("J5", params.j5 === "J2" ? "J2" : "True");

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text) as unknown as TransactionResult;
}

// Get token from transaction
export async function getToken(
  config: YaadPayConfig,
  transId: string
): Promise<TokenResult> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "getToken");
  queryParams.set("Masof", config.masof);
  queryParams.set("PassP", config.passP);
  queryParams.set("TransId", transId);

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text) as unknown as TokenResult;
}

// Commit postponed transaction
export async function commitTransaction(
  config: YaadPayConfig,
  transId: string,
  invoice?: { sendHesh?: boolean; heshDesc?: string; pritim?: boolean }
): Promise<Record<string, string>> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "commitTrans");
  queryParams.set("Masof", config.masof);
  queryParams.set("TransId", transId);
  queryParams.set("UTF8", "True");
  queryParams.set("UTF8out", "True");

  if (invoice?.sendHesh) queryParams.set("SendHesh", "True");
  if (invoice?.heshDesc) queryParams.set("heshDesc", invoice.heshDesc);
  if (invoice?.pritim) queryParams.set("Pritim", "True");

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text);
}

// Cancel transaction
export async function cancelTransaction(
  config: YaadPayConfig,
  transId: string
): Promise<Record<string, string>> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "CancelTrans");
  queryParams.set("Masof", config.masof);
  queryParams.set("TransId", transId);

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text);
}

// Refund transaction by ID
export async function refundTransaction(
  config: YaadPayConfig,
  transId: string,
  amount: number,
  options?: { tash?: number; sendHesh?: boolean }
): Promise<Record<string, string>> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "zikoyAPI");
  queryParams.set("Masof", config.masof);
  queryParams.set("PassP", config.passP);
  queryParams.set("TransId", transId);
  queryParams.set("Amount", amount.toString());
  queryParams.set("UTF8", "True");
  queryParams.set("UTF8out", "True");

  if (options?.tash) queryParams.set("Tash", options.tash.toString());
  if (options?.sendHesh) queryParams.set("SendHesh", "True");

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text);
}

// Change HK (subscription) status
export async function changeHKStatus(
  config: YaadPayConfig,
  hkId: string,
  newStat: 1 | 2 // 1=terminate, 2=activate
): Promise<Record<string, string>> {
  const queryParams = new URLSearchParams();
  queryParams.set("action", "HKStatus");
  queryParams.set("Masof", config.masof);
  queryParams.set("HKId", hkId);
  queryParams.set("NewStat", newStat.toString());

  const url = `${YAADPAY_BASE}?${queryParams.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseYaadResponse(text);
}

// Print/get invoice
export async function getInvoiceUrl(
  config: YaadPayConfig,
  params: { transId?: string; asm?: string; type: "HTML" | "PDF" | "NEW" }
): Promise<string> {
  // Step 1: APISign for invoice
  const signParams = new URLSearchParams();
  signParams.set("Masof", config.masof);
  signParams.set("action", "APISign");
  signParams.set("KEY", config.key);
  signParams.set("What", "SIGN");
  signParams.set("PassP", config.passP);
  signParams.set("ACTION", "PrintHesh");
  signParams.set("type", params.type);
  if (params.transId) signParams.set("TransId", params.transId);
  if (params.asm) signParams.set("asm", params.asm);

  const url = `${YAADPAY_CGI}?${signParams.toString()}`;
  const res = await fetch(url);
  const signedResult = await res.text();

  // Step 2: Build full URL
  return `${YAADPAY_CGI}?${signedResult}`;
}
