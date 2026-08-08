"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

function FailContent() {
  const params = useSearchParams();
  const coinId = params.get("CoinId") || "1";
  const isHebrew = coinId === "1" || !coinId;
  const dir = isHebrew ? "rtl" : "ltr";
  const ccode = params.get("CCode") || "—";

  const t = {
    title: isHebrew ? "התשלום נכשל" : "Payment Failed",
    sub: isHebrew ? "לא הצלחנו לעבד את התשלום שלך" : "We were unable to process your payment",
    code: isHebrew ? "קוד שגיאה" : "Error code",
    retry: isHebrew
      ? "ניתן לסגור חלון זה ולנסות שוב, או לפנות לבית העסק לבירור."
      : "You may close this window and try again, or contact the merchant for assistance.",
    privacy: isHebrew
      ? "המידע מאובטח בהתאם לחוק הגנת הפרטיות"
      : "Your information is protected and secure",
  };

  return (
    <div dir={dir} className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 mb-8">
        <Image src="/logo.svg" alt="Lintos" width={64} height={60} priority />
        <div className="text-center mt-1">
          <div className="text-lg font-bold text-[#4a4a4a]">Lintos</div>
          <div className="text-xs text-[#9dc020] font-medium">Technology solutions</div>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        <div className="bg-rose-50 border-b border-rose-100 py-8 flex flex-col items-center gap-3">
          <div className="size-16 rounded-full bg-rose-100 flex items-center justify-center">
            <svg className="size-9 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
              <path strokeLinecap="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-rose-800">{t.title}</h1>
          <p className="text-sm text-rose-600">{t.sub}</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {ccode !== "—" && (
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-500">{t.code}</span>
              <span className="text-sm font-mono font-medium text-slate-700">{ccode}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 pt-1 text-center">{t.retry}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">{t.privacy}</p>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={null}>
      <FailContent />
    </Suspense>
  );
}
