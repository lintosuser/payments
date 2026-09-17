"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";

type Verified = { ok: boolean; result: Record<string, string> };

const COIN_SYMBOL: Record<string, string> = { "1": "₪", "2": "$", "3": "€", "4": "£" };

function SuccessContent() {
  const params = useSearchParams();
  const isCard = params.get("card") === "1";
  const [state, setState] = useState<"loading" | Verified>(isCard ? { ok: true, result: {} } : "loading");

  useEffect(() => {
    if (isCard) return; // card-update: nothing to verify
    fetch(`/api/payments/verify?${params.toString()}`)
      .then((r) => r.json()).then((d: Verified) => setState(d))
      .catch(() => setState({ ok: false, result: {} }));
  }, [params, isCard]);

  const coinId = params.get("CoinId") || "1";
  const isHebrew = coinId === "1" || !coinId;
  const dir = isHebrew ? "rtl" : "ltr";
  const symbol = COIN_SYMBOL[coinId] || "₪";

  const amount = params.get("Amount");
  const formatted = amount
    ? `${symbol}${Number(amount).toLocaleString(isHebrew ? "he-IL" : "en-US")}`
    : null;

  const txId = state !== "loading" ? (state.result?.index || params.get("index") || "—") : null;
  const hesh = state !== "loading" ? (state.result?.Hesh || "") : null;

  const t = {
    loading: isHebrew ? "מאמת תשלום..." : "Verifying payment...",
    title: isCard ? (isHebrew ? "הכרטיס נשמר!" : "Card saved!") : (isHebrew ? "התשלום הצליח!" : "Payment Successful!"),
    thanks: isCard ? (isHebrew ? "פרטי האשראי עודכנו בהצלחה" : "Card details updated") : (isHebrew ? "תודה רבה על תשלומך" : "Thank you for your payment"),
    txLabel: isHebrew ? "מספר עסקה" : "Transaction ID",
    invLabel: isHebrew ? "חשבונית" : "Invoice",
    note: isHebrew
      ? "אישור נשלח לאימייל. ניתן לסגור חלון זה."
      : "A confirmation was sent to your email. You may close this window.",
    privacy: isHebrew
      ? "המידע מאובטח בהתאם לחוק הגנת הפרטיות"
      : "Your information is protected and secure",
    failed: isHebrew ? "אימות התשלום נכשל" : "Payment verification failed",
    failNote: isHebrew ? "פנה לעסק שביצע את החיוב לבירור." : "Please contact the merchant for assistance.",
  };

  return (
    <div dir={dir} className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      {/* Logo */}
      <div className={`flex flex-col items-center gap-1 mb-8 ${isHebrew ? "" : "flex-col"}`}>
        <Image src="/logo.svg" alt="Lintos" width={64} height={60} priority />
        <div className="text-center mt-1">
          <div className="text-lg font-bold text-[#4a4a4a]">Lintos</div>
          <div className="text-xs text-[#9dc020] font-medium">Technology solutions</div>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        {state === "loading" ? (
          <div className="py-16 flex flex-col items-center gap-4 text-slate-500">
            <Loader2 className="size-10 animate-spin text-slate-300" />
            <p className="text-sm">{t.loading}</p>
          </div>
        ) : state.ok ? (
          <>
            {/* Green header strip */}
            <div className="bg-emerald-50 border-b border-emerald-100 py-8 flex flex-col items-center gap-3">
              <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-9 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-emerald-800">{t.title}</h1>
              <p className="text-sm text-emerald-600">{t.thanks}</p>
              {formatted && (
                <div className="mt-1 text-3xl font-extrabold text-slate-800 tracking-tight" dir="ltr">
                  {formatted}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-3">
              {txId && (
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">{t.txLabel}</span>
                  <span className="text-sm font-mono font-medium text-slate-700">{txId}</span>
                </div>
              )}
              {hesh && hesh !== "0" && (
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">{t.invLabel}</span>
                  <span className="text-sm font-mono font-medium text-slate-700">#{hesh}</span>
                </div>
              )}
              <p className="text-xs text-slate-400 pt-1 text-center">{t.note}</p>
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center gap-3 px-6">
            <div className="size-16 rounded-full bg-rose-50 flex items-center justify-center">
              <svg className="size-9 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                <path strokeLinecap="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{t.failed}</h1>
            <p className="text-sm text-slate-500 text-center">{t.failNote}</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">{t.privacy}</p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
