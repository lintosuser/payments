"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, KeyRound, Download, Upload, FileSpreadsheet, ShieldCheck, Percent, Mail } from "lucide-react";

const VAT_STORAGE_KEY = "lintos.vatPercent";
export const DEFAULT_VAT_PERCENT = 18;

export function getVatPercent(): number {
  if (typeof window === "undefined") return DEFAULT_VAT_PERCENT;
  const raw = localStorage.getItem(VAT_STORAGE_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_VAT_PERCENT;
}

type ProviderName = "tranzila" | "yaadpay";

type Bookkeeping = { businessName: string; businessHp: string; email: string; cc: string };
type Status = {
  db: { url: string; provider: string; configured: boolean };
  payments: {
    active: ProviderName;
    configured: boolean;
    publicId: string;
    available: { name: ProviderName; configured: boolean }[];
  };
  bookkeeping?: Bookkeeping;
  vatPercent?: number;
};

const PROVIDER_LABEL: Record<ProviderName, string> = {
  tranzila: "Tranzila",
  yaadpay: "YaadPay",
};

export function SettingsTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dbUrl, setDbUrl] = useState("");
  const [publicId, setPublicId] = useState("");
  const [password, setPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [vatInput, setVatInput] = useState<string>(String(DEFAULT_VAT_PERCENT));
  const [bk, setBk] = useState<Bookkeeping>({ businessName: "", businessHp: "", email: "", cc: "" });
  const [bkSaving, setBkSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s: Status) => {
      setStatus(s);
      setDbUrl(s.db.url);
      setPublicId(s.payments.publicId);
      if (s.bookkeeping) setBk(s.bookkeeping);
      if (typeof s.vatPercent === "number") {
        setVatInput(String(s.vatPercent));
        try { localStorage.setItem(VAT_STORAGE_KEY, String(s.vatPercent)); } catch {}
      }
    });
    setVatInput(String(getVatPercent()));
  }, []);

  const saveBk = async () => {
    setBkSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bk),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || "שגיאה בשמירה"); return; }
      if (j.bookkeeping) setBk(j.bookkeeping);
      toast.success("הגדרות הנה״ח נשמרו");
    } finally {
      setBkSaving(false);
    }
  };

  const saveVat = async () => {
    const n = parseFloat(vatInput);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("אחוז מע״מ לא תקין (0-100)");
      return;
    }
    const res = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vatPercent: n }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(j.error || "שגיאה בשמירת מע״מ"); return; }
    try { localStorage.setItem(VAT_STORAGE_KEY, String(n)); } catch {}
    toast.success(`מע״מ עודכן ל-${n}% (חל על חשבוניות ומסמכים)`);
  };

  const active: ProviderName = status?.payments.active || "tranzila";
  const label = PROVIDER_LABEL[active];
  const idLabel = active === "tranzila" ? "TRANZILA_TERMINAL" : "YAADPAY_MASOF";
  const pwLabel = active === "tranzila" ? "TRANZILA_PASSWORD" : "YAADPAY_PASSP";

  const envBlock = `# ─── SQL Server ──────────────
DB_HOST=localhost
DB_PORT=1433
DB_NAME=PaymentsDB
DB_USER=paymentUser
DB_PASSWORD="••••••••"
DB_ENCRYPT=true
DB_TRUST_SERVER_CERT=true

# ─── Auth ────────────────────
AUTH_SECRET="<32+ char random string>"

# ─── Payment Provider ────────
# tranzila (default) | yaadpay
PAYMENT_PROVIDER=${active}

# ─── Tranzila ────────────────
TRANZILA_TERMINAL=${active === "tranzila" ? (publicId || "your_terminal_name") : "your_terminal_name"}
TRANZILA_PASSWORD=${active === "tranzila" ? (password || "your_terminal_password") : "your_terminal_password"}

# ─── YaadPay ─────────────────
YAADPAY_MASOF=${active === "yaadpay" ? (publicId || "0010131918") : "0010131918"}
YAADPAY_PASSP=${active === "yaadpay" ? (password || "your_passp") : "your_passp"}
YAADPAY_KEY=your_api_key

# ─── App ─────────────────────
APP_URL="https://paym.lintos-tech.com"`;

  const copyEnv = () => {
    navigator.clipboard.writeText(envBlock);
    toast.success(".env הועתק");
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/clients/csv", { method: "POST", body: text, headers: { "Content-Type": "text/csv" } });
      const data = await res.json();
      if (res.ok) {
        toast.success(`יובאו ${data.created} חדשים · ${data.updated} עודכנו · ${data.skipped} דולגו`);
      } else {
        toast.error("שגיאה בייבוא");
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center">
              <Percent className="size-5" />
            </div>
            <div>
              <CardTitle>אחוז מע״מ</CardTitle>
              <CardDescription>
                אחוז המע״מ הנוכחי לחישוב אוטומטי בטופס יצירת קישור התשלום (לפני/כולל מע״מ).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="w-40">
              <Label>מע״מ (%)</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={vatInput}
                onChange={(e) => setVatInput(e.target.value)}
                className="tabular"
              />
            </div>
            <Button onClick={saveVat}>שמור</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            נשמר בדפדפן זה בלבד. עדכן כאן כשמע״מ בישראל משתנה.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center">
              <Mail className="size-5" />
            </div>
            <div>
              <CardTitle>שליחת חשבוניות להנהלת חשבונות</CardTitle>
              <CardDescription>
                כל חשבונית שנוצרת נשלחת אוטומטית לכתובת זו (עם ה-CC), בצירוף שם העסק וה-ח.פ.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>שם העסק</Label>
              <Input value={bk.businessName} onChange={(e) => setBk({ ...bk, businessName: e.target.value })} placeholder="Lintos Technology Solutions" />
            </div>
            <div>
              <Label>ח.פ.</Label>
              <Input dir="ltr" value={bk.businessHp} onChange={(e) => setBk({ ...bk, businessHp: e.target.value })} placeholder="35714948" />
            </div>
            <div>
              <Label>אימייל הנה״ח (נמען)</Label>
              <Input dir="ltr" type="email" value={bk.email} onChange={(e) => setBk({ ...bk, email: e.target.value })} placeholder="bk@mail.paperless.tax" />
            </div>
            <div>
              <Label>עותק CC</Label>
              <Input dir="ltr" type="email" value={bk.cc} onChange={(e) => setBk({ ...bk, cc: e.target.value })} placeholder="you@example.com" />
            </div>
          </div>
          <Button onClick={saveBk} disabled={bkSaving}>{bkSaving ? "שומר..." : "שמור"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center">
              <Database className="size-5" />
            </div>
            <div>
              <CardTitle>SQL Server</CardTitle>
              <CardDescription>
                מסד נתונים, אימות ו-CRM דרך SQL Server. ערכים נטענים מ-<code className="font-mono text-xs">.env</code>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>DB connection</Label>
            <Input
              dir="ltr"
              className="font-mono text-xs"
              value={dbUrl}
              readOnly
              placeholder="mssql://host/dbname"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              חיבור דרך <code className="font-mono">DB_HOST</code> / <code className="font-mono">DB_NAME</code> / <code className="font-mono">DB_USER</code> ב-<code className="font-mono">.env.local</code>.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-3 flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">מצב נוכחי:</span>{" "}
              {status ? (
                <>
                  {status.db.provider}{" "}
                  <Badge variant="secondary" className={status.db.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                    {status.db.configured ? "פעיל" : "לא מוגדר"}
                  </Badge>
                </>
              ) : "טוען..."}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center">
              <KeyRound className="size-5" />
            </div>
            <div>
              <CardTitle>ספק תשלום — {label}</CardTitle>
              <CardDescription>
                ספק פעיל נקבע ע&quot;י <code className="font-mono text-xs">PAYMENT_PROVIDER</code> (ברירת מחדל: tranzila). שדות נטענים מ-<code className="font-mono text-xs">.env</code>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div className="flex gap-2 flex-wrap">
              {status.payments.available.map((p) => (
                <Badge
                  key={p.name}
                  variant={p.name === active ? "default" : "secondary"}
                  className={p.configured ? (p.name === active ? "" : "bg-emerald-100 text-emerald-800") : "bg-amber-100 text-amber-800"}
                >
                  {PROVIDER_LABEL[p.name]} {p.name === active ? "• פעיל" : ""} {p.configured ? "✓" : "—"}
                </Badge>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{idLabel}</Label>
              <Input dir="ltr" value={publicId} onChange={(e) => setPublicId(e.target.value)} placeholder={active === "tranzila" ? "your_terminal_name" : "0010131918"} />
            </div>
            <div>
              <Label>{pwLabel}</Label>
              <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-3 flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">מצב {label}:</span>{" "}
              {status ? (
                <Badge variant="secondary" className={status.payments.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                  {status.payments.configured ? `פעיל — ${status.payments.publicId}` : "לא מוגדר"}
                </Badge>
              ) : "טוען..."}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            הגדר את ה-Notify URL במסוף {label} ל: <code className="font-mono">{"{APP_URL}"}/api/payments/notify</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>קובץ .env</CardTitle>
          <CardDescription>
            העתק את הבלוק הבא ל-<code className="font-mono text-xs">.env.local</code> בשורש הפרויקט והרץ <code className="font-mono text-xs">npm run dev</code>.
            ערכים אלו אינם נשמרים במסד.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre dir="ltr" className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-x-auto whitespace-pre">
{envBlock}
          </pre>
          <Button variant="outline" onClick={copyEnv}>העתק .env</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <CardTitle>ייבוא וייצוא CSV</CardTitle>
              <CardDescription>גיבוי וייבוא מסיבי של לקוחות ועסקאות. UTF-8 BOM נכלל לתאימות Excel.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">לקוחות</h4>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" render={<a href="/api/clients/csv" download />}>
                <Download className="size-4" /> ייצוא
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                render={
                  <label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                    />
                  </label>
                }
              >
                <Upload className="size-4" /> {importing ? "מייבא..." : "ייבוא"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              עמודות נדרשות: first_name, last_name, user_id, email, cell. לקוח קיים (לפי user_id) יעודכן.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">עסקאות</h4>
            </div>
            <Button variant="outline" size="sm" render={<a href="/api/transactions/csv" download />}>
              <Download className="size-4" /> ייצוא היסטוריה
            </Button>
            <p className="text-xs text-muted-foreground">
              כולל סטטוס, סכום, מטבע, פרטי כרטיס מוסתרים, וקישור ללקוח.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
