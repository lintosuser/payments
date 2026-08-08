"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, KeyRound, ArrowRight, RotateCw } from "lucide-react";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || "שגיאה בשליחת קוד"); return; }
      toast.success("קוד נשלח לאימייל שלך");
      setStep("otp");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || "קוד שגוי"); return; }
      router.replace(next);
      router.refresh();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setOtp("");
    setLoading(true);
    try {
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast.success("קוד חדש נשלח");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.svg" alt="Lintos" width={80} height={75} priority />
          <div className="text-center">
            <div className="text-2xl font-bold text-[#4a4a4a] tracking-tight">Lintos</div>
            <div className="text-sm text-[#9dc020] font-medium">Technology solutions</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {step === "email" ? (
            <form onSubmit={handleSend} className="space-y-5" dir="rtl">
              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-slate-800">כניסה למערכת</h1>
                <p className="text-sm text-slate-500">נשלח קוד חד-פעמי לאימייל שלך</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">כתובת אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="email"
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pr-10 text-left"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 bg-[#4a4a4a] hover:bg-[#333]" size="lg" disabled={loading}>
                {loading ? <RotateCw className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                {loading ? "שולח..." : "שלח קוד"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5" dir="rtl">
              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-slate-800">הזן קוד אימות</h1>
                <p className="text-sm text-slate-500">
                  קוד נשלח ל-<span dir="ltr" className="font-medium text-slate-700">{email}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-700">קוד חד-פעמי (6 ספרות)</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="otp"
                    dir="ltr"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="pr-10 text-center text-2xl font-mono tracking-widest"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 bg-[#9dc020] hover:bg-[#8ab01a] text-white" size="lg" disabled={loading || otp.length < 6}>
                {loading ? <RotateCw className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {loading ? "מאמת..." : "כניסה"}
              </Button>
              <div className="flex justify-between items-center pt-1">
                <button type="button" onClick={() => { setStep("email"); setOtp(""); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  שנה אימייל
                </button>
                <button type="button" onClick={handleResend} disabled={loading}
                  className="text-xs text-[#9dc020] hover:text-[#7a9e10] transition-colors font-medium">
                  שלח קוד שוב
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          המידע מאובטח בהתאם לחוק הגנת הפרטיות
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
