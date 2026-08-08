"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "./topbar";
import { ArrowLeft, Link2, CreditCard, UserPlus, FileText } from "lucide-react";
import type { NavKey } from "./sidebar";

interface Transaction {
  id: string;
  yaad_id: string;
  client_id: string | null;
  amount: number;
  coin: number;
  status: string;
  info: string;
  type: string;
  created_at: string;
}
interface Client { id: string }

const coinSymbol: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };
const statusLabel: Record<string, string> = {
  approved: "אושר", pending: "ממתין", cancelled: "בוטל",
  refunded: "זוכה", postponed: "נדחה", failed: "נכשל",
};
function statusTone(s: string) {
  switch (s) {
    case "approved": return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "pending": return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "postponed": return "bg-sky-50 text-sky-700 ring-sky-600/20";
    case "refunded": return "bg-orange-50 text-orange-700 ring-orange-600/20";
    case "cancelled":
    case "failed": return "bg-rose-50 text-rose-700 ring-rose-600/20";
    default: return "bg-muted text-muted-foreground ring-border";
  }
}

function Stat({
  label, value, accent, loading,
}: { label: string; value: string; accent?: "primary" | "amber" | "neutral"; loading: boolean }) {
  const accentClass =
    accent === "primary" ? "text-primary"
    : accent === "amber" ? "text-amber-600"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-2 text-3xl font-semibold tabular ${accentClass}`}>
          {loading ? <span className="inline-block w-20 h-7 bg-muted rounded animate-pulse" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ]).then(([txs, cls]) => {
      setTransactions(Array.isArray(txs) ? txs : []);
      setClients(Array.isArray(cls) ? cls : []);
      setLoading(false);
    });
  }, []);

  const totalRevenue = transactions
    .filter((t) => t.status === "approved" && t.type !== "refund")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const approvedCount = transactions.filter((t) => t.status === "approved").length;
  const pendingCount = transactions.filter((t) => t.status === "pending" || t.status === "postponed").length;

  const quickActions = [
    { key: "payments", title: "קישור תשלום", desc: "שלח דף תשלום מאובטח", Icon: Link2 },
    { key: "charge", title: "חיוב טוקן", desc: "גבייה מלקוח קיים", Icon: CreditCard },
    { key: "clients", title: "לקוח חדש", desc: "הוספה ידנית או CSV", Icon: UserPlus },
    { key: "invoices", title: "חשבונית", desc: "הפק או שלוף", Icon: FileText },
  ] as const;

  return (
    <div>
      <Topbar
        title="סקירה"
        description="המצב הנוכחי של החשבון, קיצורי פעולות ועסקאות אחרונות."
        actions={
          <Button onClick={() => onNavigate("payments")} className="gap-2">
            <Link2 className="size-4" /> קישור תשלום
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="הכנסות מאושרות" value={`₪${totalRevenue.toLocaleString()}`} accent="primary" loading={loading} />
        <Stat label="עסקאות אושרו" value={`${approvedCount}`} loading={loading} />
        <Stat label="ממתינות / דחויות" value={`${pendingCount}`} accent="amber" loading={loading} />
        <Stat label="לקוחות" value={`${clients.length}`} loading={loading} />
      </div>

      <h2 className="mt-10 mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">פעולות מהירות</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map(({ key, title, desc, Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key as NavKey)}
            className="group text-right rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <Icon className="size-5 text-primary" />
              <ArrowLeft className="size-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div className="mt-3 text-base font-medium">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">עסקאות אחרונות</h2>
        <Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")} className="gap-1">
          הצג הכל <ArrowLeft className="size-3.5" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-base font-medium">עדיין אין עסקאות</div>
              <p className="mt-1 text-sm text-muted-foreground">צור קישור תשלום ראשון ושלח ללקוח.</p>
              <Button className="mt-4" onClick={() => onNavigate("payments")}>יצירת קישור תשלום</Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.slice(0, 6).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className={`ring-1 ${statusTone(tx.status)}`}>
                      {statusLabel[tx.status] || tx.status}
                    </Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{tx.info}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {tx.yaad_id ? `#${tx.yaad_id}` : "ממתין"} · {new Date(tx.created_at).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular shrink-0">
                    {tx.type === "refund" ? "−" : ""}{coinSymbol[tx.coin] || "₪"}{tx.amount.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
