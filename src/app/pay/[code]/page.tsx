"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, CreditCard, Lock } from "lucide-react";

const COIN_SYMBOL: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };

interface HandshakeData {
  thtk: string;
  terminalName: string;
  amount: number;
  coin: number;
  info: string;
  contact: string;
  email: string;
  phone: string;
  txId: string;
  hk: boolean;
  mode?: "charge" | "update";
}

// Types for Tranzila's Hosted Fields SDK (loaded from thostedf.js).
interface TzlaFields {
  charge(
    payload: Record<string, unknown>,
    cb: (err: unknown, response: unknown) => void,
  ): void;
}
interface TzlaHostedFieldsStatic {
  create(config: Record<string, unknown>): TzlaFields;
}
declare global {
  interface Window {
    TzlaHostedFields?: TzlaHostedFieldsStatic;
  }
}

const SDK_URL = "https://hf.tranzila.com/assets/js/thostedf.js";

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.TzlaHostedFields) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SDK load failed"));
    document.head.appendChild(s);
  });
}

export default function PayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params?.code || "";

  const [state, setState] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [handshake, setHandshake] = useState<HandshakeData | null>(null);
  const [cardholderName, setCardholderName] = useState("");
  const [cardholderId, setCardholderId] = useState("");
  const fieldsRef = useRef<TzlaFields | null>(null);

  // 1. Fetch handshake + load SDK in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hsRes] = await Promise.all([
          fetch(`/api/payments/handshake?code=${encodeURIComponent(code)}`),
          loadSdk(),
        ]);
        if (cancelled) return;
        if (!hsRes.ok) {
          const j = await hsRes.json().catch(() => ({}));
          throw new Error(j.error || `handshake ${hsRes.status}`);
        }
        const data: HandshakeData = await hsRes.json();
        if (!cancelled) setHandshake(data);
      } catch (e) {
        if (cancelled) return;
        console.error("[pay] handshake/sdk error:", e);
        setErrorMsg(e instanceof Error ? e.message : "שגיאה בטעינת דף התשלום");
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  // 2. Mount Hosted Fields ONCE both the handshake data and the DOM mount
  //    points are present (the mount divs render conditionally on handshake).
  useEffect(() => {
    if (!handshake || fieldsRef.current) return;
    if (typeof window === "undefined" || !window.TzlaHostedFields) {
      setErrorMsg("SDK של Tranzila לא נטען");
      setState("error");
      return;
    }
    if (!document.getElementById("credit_card_number") || !document.getElementById("expiry") || !document.getElementById("CVV")) {
      console.error("[pay] mount points missing at effect time");
      setErrorMsg("שגיאה באתחול שדות הכרטיס");
      setState("error");
      return;
    }
    try {
      fieldsRef.current = window.TzlaHostedFields.create({
        sandbox: false,
        fields: {
          credit_card_number: { selector: "#credit_card_number", placeholder: "0000 0000 0000 0000", tabindex: 1 },
          cvv: { selector: "#CVV", placeholder: "CVV", tabindex: 3 },
          expiry: { selector: "#expiry", placeholder: "MM/YY", version: "1", tabindex: 2 },
        },
        styles: {
          "input": {
            "height": "100%",
            "width": "100%",
            "text-align": "center",
            "font-size": "16px",
            "color": "#0f172a",
            "padding": "0",
            "background": "transparent",
            "font-family": "system-ui, -apple-system, Segoe UI, sans-serif",
          },
          "::placeholder": { "color": "#94a3b8", "opacity": "1" },
        },
      });
      setState("ready");
      setErrorMsg("");
    } catch (e) {
      console.error("[pay] TzlaHostedFields.create failed:", e);
      setErrorMsg("שגיאה באתחול שדות הכרטיס");
      setState("error");
    }
  }, [handshake]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handshake || !fieldsRef.current || state !== "ready") return;
    setState("submitting");
    setErrorMsg("");

    const CURRENCY_CODE: Record<number, string> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

    // Minimal payload — Tranzila terminals vary in which optional fields they
    // accept. Amount is sent as a fixed-2 string (matches Station's payload).
    const isUpdate = handshake.mode === "update";
    const payload: Record<string, unknown> = {
      terminal_name: handshake.terminalName,
      thtk: handshake.thtk,
      amount: handshake.amount.toFixed(2),
      currency_code: CURRENCY_CODE[handshake.coin] || "ILS",
      tokenize: true,
      response_language: handshake.coin === 1 ? "Hebrew" : "English",
      // J2 Validate: verify + tokenize the card WITHOUT charging.
      ...(isUpdate ? { tran_mode: "N" } : {}),
    };
    if (cardholderName || handshake.contact) payload.contact = cardholderName || handshake.contact;
    if (handshake.email) payload.email = handshake.email;
    if (handshake.info) payload.pdesc = handshake.info;
    if (cardholderId) payload.user_form_data = JSON.stringify({ cardholder_id: cardholderId });

    fieldsRef.current.charge(payload, async (err, response) => {
      if (err) {
        console.error("[pay] charge err:", JSON.stringify(err));
        // Ship raw error + payload we sent to the server so we can diagnose
        // without needing the customer's dev console.
        fetch("/api/payments/diag-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code, when: "charge-err",
            sentPayload: { ...payload, thtk: "[redacted]" },
            err,
          }),
        }).catch(() => {});
        const e = err as { messages?: Array<{ param?: string; message?: string }>; message?: string };
        const first = e?.messages?.[0];
        if (first) {
          const paramLabel = first.param ? `[${first.param}] ` : "";
          setErrorMsg(`${paramLabel}${first.message || "שגיאה בפרטי הכרטיס"}`);
        } else {
          setErrorMsg(e?.message || "פרטי הכרטיס לא תקינים");
        }
        setState("ready");
        return;
      }
      const r = response as {
        errors?: Array<{ message?: string }>;
        transaction_response?: {
          success: boolean;
          processor_response_code: string;
          transaction_id?: string;
          token?: string;
          credit_card_last_4_digits?: string | number;
          card_type_name?: string;
          expiry_month?: string;
          expiry_year?: string;
          auth_number?: string;
        };
      };

      if (r?.errors && r.errors.length > 0) {
        setErrorMsg(r.errors[0].message || "שגיאה באימות כרטיס");
        setState("ready");
        return;
      }
      const trx = r?.transaction_response;
      if (!trx || !trx.success || (trx.processor_response_code !== "000" && trx.processor_response_code !== "0000")) {
        setErrorMsg(`התשלום נדחה (קוד ${trx?.processor_response_code || "?"})`);
        setState("ready");
        return;
      }

      try {
        const res = await fetch("/api/payments/hf-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            transactionId: trx.transaction_id,
            token: trx.token,
            last4: String(trx.credit_card_last_4_digits || ""),
            expiryMonth: trx.expiry_month,
            expiryYear: trx.expiry_year,
            cardBrand: trx.card_type_name,
            authNumber: trx.auth_number,
            responseCode: trx.processor_response_code,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "server rejected");
        // Card-update flow: nothing was charged — show a simple saved screen.
        if (isUpdate || j.cardUpdated) {
          router.replace(`/payment/success?card=1&CoinId=${handshake.coin}`);
          return;
        }
        // Success — include the fields /api/payments/verify parses via
        // provider.parseRedirect (needs Response=000 to consider it success).
        const successParams = new URLSearchParams({
          Response: trx.processor_response_code || "000",
          index: trx.transaction_id || "",
          ConfirmationCode: trx.auth_number || "",
          sum: String(handshake.amount),
          currency: String(handshake.coin),
          Amount: String(handshake.amount),
          CoinId: String(handshake.coin),
          ...(j.hesh ? { Hesh: String(j.hesh) } : {}),
        });
        router.replace(`/payment/success?${successParams}`);
      } catch (e) {
        console.error("[pay] complete error:", e);
        setErrorMsg("החיוב אושר אך שמירת הרישום נכשלה. פנה למוכר.");
        setState("error");
      }
    });
  };

  const isHebrew = (handshake?.coin ?? 1) === 1;
  const dir = isHebrew ? "rtl" : "ltr";
  const sym = COIN_SYMBOL[handshake?.coin ?? 1];
  const amountStr = handshake ? `${sym}${handshake.amount.toLocaleString(isHebrew ? "he-IL" : "en-US")}` : "";

  return (
    <div dir={dir} className="min-h-screen flex flex-col items-center bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="flex flex-col items-center gap-1 mb-6">
        <Image src="/logo.svg" alt="Lintos" width={56} height={52} priority />
        <div className="text-center">
          <div className="text-base font-bold text-[#4a4a4a]">Lintos</div>
          <div className="text-[11px] text-[#9dc020] font-medium">Technology solutions</div>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        {!handshake && state === "error" ? (
          <div className="p-8 text-center">
            <h1 className="text-lg font-bold text-rose-700">{isHebrew ? "שגיאה" : "Error"}</h1>
            <p className="mt-2 text-sm text-slate-600">{errorMsg}</p>
          </div>
        ) : !handshake ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="size-8 animate-spin text-slate-300" />
            <p className="text-sm">{isHebrew ? "טוען..." : "Loading..."}</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 text-center">
              {handshake.mode === "update" ? (
                <>
                  <p className="text-lg font-bold text-slate-800">{isHebrew ? "עדכון פרטי אשראי" : "Update card details"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{isHebrew ? "הכרטיס יישמר לחיובים עתידיים — ללא חיוב כעת" : "Card saved for future charges — no charge now"}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-1">{handshake.info || (isHebrew ? "תשלום" : "Payment")}</p>
                  <p className="text-3xl font-extrabold text-slate-800 tracking-tight" dir="ltr">{amountStr}</p>
                  {handshake.hk && (
                    <p className="mt-1 text-[11px] text-emerald-700 font-medium">{isHebrew ? "כולל הוראת קבע" : "Includes standing order"}</p>
                  )}
                </>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {isHebrew ? "שם בעל הכרטיס" : "Cardholder name"}
                </label>
                <input
                  type="text" required autoComplete="cc-name"
                  value={cardholderName} onChange={(e) => setCardholderName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                  placeholder={isHebrew ? "ישראל ישראלי" : "Full name"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {isHebrew ? "תעודת זהות" : "ID number"}
                  <span className="text-slate-400 font-normal"> ({isHebrew ? "אופציונלי" : "optional"})</span>
                </label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  value={cardholderId} onChange={(e) => setCardholderId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                  placeholder={isHebrew ? "9 ספרות" : "9 digits"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  {isHebrew ? "מספר כרטיס" : "Card number"}
                </label>
                <div id="credit_card_number" className="w-full h-11 rounded-lg border border-slate-200 bg-white overflow-hidden" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{isHebrew ? "תוקף" : "Expiry"}</label>
                  <div id="expiry" className="w-full h-11 rounded-lg border border-slate-200 bg-white overflow-hidden" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CVV</label>
                  <div id="CVV" className="w-full h-11 rounded-lg border border-slate-200 bg-white overflow-hidden" />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700 text-center">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={state === "submitting"}
                className="w-full mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {state === "submitting" ? (
                  <><Loader2 className="size-4 animate-spin" />{isHebrew ? "מעבד..." : "Processing..."}</>
                ) : handshake?.mode === "update" ? (
                  <><Lock className="size-4" />{isHebrew ? "שמור כרטיס" : "Save card"}</>
                ) : (
                  <><Lock className="size-4" />{isHebrew ? `שלם ${amountStr}` : `Pay ${amountStr}`}</>
                )}
              </button>

              <p className="text-[11px] text-slate-400 text-center pt-1">
                {isHebrew ? "התשלום מאובטח על ידי Tranzila. פרטי הכרטיס אינם עוברים דרך שרת האתר." : "Payment secured by Tranzila. Card data never touches this server."}
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
