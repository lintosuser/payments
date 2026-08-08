"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditRow {
  id: string;
  user_email: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  ip: string;
  created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  "auth.login": "bg-blue-100 text-blue-800",
  "auth.logout": "bg-slate-100 text-slate-700",
  "client.create": "bg-green-100 text-green-800",
  "client.update": "bg-yellow-100 text-yellow-800",
  "client.delete": "bg-red-100 text-red-800",
  "payment.create_link": "bg-indigo-100 text-indigo-800",
  "payment.charge": "bg-purple-100 text-purple-800",
  "payment.refund": "bg-orange-100 text-orange-800",
  "subscription.create": "bg-teal-100 text-teal-800",
  "subscription.toggle": "bg-cyan-100 text-cyan-800",
  "subscription.delete": "bg-red-100 text-red-700",
  "invoice.create": "bg-emerald-100 text-emerald-800",
  "invoice.resend": "bg-emerald-50 text-emerald-700",
  "cron.charge_run": "bg-violet-100 text-violet-800",
};

const ALL_ACTIONS = [
  "auth.login", "auth.logout",
  "client.create", "client.update", "client.delete",
  "payment.create_link", "payment.charge", "payment.refund",
  "subscription.create", "subscription.toggle", "subscription.delete",
  "invoice.create", "invoice.resend",
  "cron.charge_run",
];

export function AuditLogTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action && action !== "all") params.set("action", action);
      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (s: string) => {
    const d = new Date(s + "Z");
    return d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", hour12: false });
  };

  const formatDetails = (s: string) => {
    if (!s) return null;
    try { return JSON.stringify(JSON.parse(s), null, 0).replace(/[{}"]/g, "").replace(/,/g, " | "); }
    catch { return s; }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold">יומן אירועים (ISO 27001 A.12.4)</h2>
        <div className="mr-auto flex items-center gap-2">
          <Select value={action} onValueChange={(v) => { if (v) { setAction(v); setPage(1); } }}>
            <SelectTrigger className="w-52 text-sm">
              <SelectValue placeholder="כל הפעולות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הפעולות</SelectItem>
              {ALL_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}>רענן</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">רשומות ביקורת</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">טוען...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">אין רשומות</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="py-2 px-2 text-right font-medium">תאריך</th>
                    <th className="py-2 px-2 text-right font-medium">משתמש</th>
                    <th className="py-2 px-2 text-right font-medium">פעולה</th>
                    <th className="py-2 px-2 text-right font-medium">ישות</th>
                    <th className="py-2 px-2 text-right font-medium">פרטים</th>
                    <th className="py-2 px-2 text-right font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="py-2 px-2 max-w-[160px] truncate text-xs">{row.user_email}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[row.action] || "bg-gray-100 text-gray-700"}`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {row.entity && <span>{row.entity}</span>}
                        {row.entity_id && <span className="block truncate max-w-[100px] font-mono text-[10px]">{row.entity_id}</span>}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                        {formatDetails(row.details)}
                      </td>
                      <td className="py-2 px-2 text-xs font-mono text-muted-foreground">{row.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          <ChevronRight className="h-4 w-4" />
          הקודם
        </Button>
        <span className="flex items-center text-sm text-muted-foreground px-2">עמוד {page}</span>
        <Button variant="outline" size="sm" disabled={rows.length < 50} onClick={() => setPage(p => p + 1)}>
          הבא
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
