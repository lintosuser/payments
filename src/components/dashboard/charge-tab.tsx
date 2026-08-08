"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { CreditCard, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { clientDisplayName, hasValidName } from "@/lib/client-name";

interface Client {
  id: string; business_name: string; first_name: string; last_name: string; email: string; cell: string; user_id: string;
  token?: string | null; token_exp_month?: string | null; token_exp_year?: string | null;
}

const COIN_SYMBOL: Record<string, string> = { "1": "₪", "2": "$", "3": "€", "4": "£" };

export function ChargeTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [form, setForm] = useState({
    token: "", tmonth: "", tyear: "", amount: "", info: "", order: "",
    tash: "1", coin: "1", businessName: "", clientName: "", clientLName: "", userId: "",
    email: "", cell: "",
    sendHesh: true, sendemail: true, heshDesc: "", postpone: false, j5: false,
  });
  const [result, setResult] = useState<{ success: boolean; message: string; result?: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : [])); }, []);

  const handleClientSelect = (id: string) => {
    setSelectedClient(id);
    if (id) {
      const c = clients.find((cl) => cl.id === id);
      if (c) setForm((f) => ({
        ...f, businessName: c.business_name, clientName: c.first_name, clientLName: c.last_name, userId: c.user_id,
        email: c.email, cell: c.cell, token: c.token || "",
        tmonth: c.token_exp_month || "", tyear: c.token_exp_year || "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient && !hasValidName({ business_name: form.businessName, first_name: form.clientName, last_name: form.clientLName })) {
      toast.error("יש להזין שם עסק או שם פרטי + שם משפחה");
      return;
    }
    setLoading(true); setResult(null);
    const body: Record<string, unknown> = {
      amount: parseFloat(form.amount), info: form.info, order: form.order,
      tash: parseInt(form.tash) || 1, coin: parseInt(form.coin),
      sendHesh: form.sendHesh, sendemail: form.sendemail, postpone: form.postpone, j5: form.j5,
    };
    if (selectedClient) body.clientId = selectedClient;
    else Object.assign(body, {
      token: form.token, tmonth: form.tmonth, tyear: form.tyear,
      businessName: form.businessName,
      clientName: form.clientName, clientLName: form.clientLName, userId: form.userId,
      email: form.email, cell: form.cell,
    });
    if (form.heshDesc) body.heshDesc = form.heshDesc;

    const res = await fetch("/api/payments/charge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setResult(data);
    if (data.success) toast.success("חיוב בוצע"); else toast.error(data.message || "חיוב נכשל");
    setLoading(false);
  };

  const tokenClients = clients.filter((c) => c.token);
  const amountNum = parseFloat(form.amount) || 0;

  return (
    <div>
      <Topbar
        title="חיוב טוקן"
        description="חיוב לקוח קיים דרך טוקן שמור (Soft Protocol), או הזנת טוקן ידני."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">לקוח עם טוקן</h3>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedClient} onChange={(e) => handleClientSelect(e.target.value)}>
                  <option value="">— הזנת טוקן ידנית —</option>
                  {tokenClients.map((c) => (
                    <option key={c.id} value={c.id}>{clientDisplayName(c)} · ****{c.token?.slice(-4)}</option>
                  ))}
                </select>
                {clients.length > 0 && tokenClients.length === 0 && (
                  <div className="rounded-md border border-amber-600/20 bg-amber-50 text-amber-800 px-3 py-2 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4" /> אין לקוחות עם טוקן. הוסף מהלשונית &quot;לקוחות&quot;.
                  </div>
                )}

                {!selectedClient && (
                  <div className="space-y-3 pt-2">
                    <div><Label>שם עסק</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="או שם פרטי + שם משפחה" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>שם פרטי</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
                      <div><Label>שם משפחה</Label><Input value={form.clientLName} onChange={(e) => setForm({ ...form, clientLName: e.target.value })} /></div>
                      <div><Label>{form.businessName.trim() ? "ח.פ." : "ת.ז."} *</Label><Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required={!selectedClient} /></div>
                      <div><Label>אימייל</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    </div>
                    <div><Label>טוקן (CC) *</Label><Input dir="ltr" className="tabular" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="19 ספרות" required={!selectedClient} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>חודש תוקף (MM)</Label><Input dir="ltr" className="tabular" value={form.tmonth} onChange={(e) => setForm({ ...form, tmonth: e.target.value })} placeholder="12" required={!selectedClient} /></div>
                      <div><Label>שנת תוקף (YYYY)</Label><Input dir="ltr" className="tabular" value={form.tyear} onChange={(e) => setForm({ ...form, tyear: e.target.value })} placeholder="2027" required={!selectedClient} /></div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">עסקה</h3>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div><Label>סכום *</Label><Input type="number" step="0.01" min="0.1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="tabular text-lg font-medium" /></div>
                  <div>
                    <Label>מטבע</Label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.coin} onChange={(e) => setForm({ ...form, coin: e.target.value })}>
                      <option value="1">₪ ILS</option><option value="2">$ USD</option><option value="3">€ EUR</option><option value="4">£ GBP</option>
                    </select>
                  </div>
                </div>
                <div><Label>תיאור עסקה *</Label><Input value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>מספר הזמנה</Label><Input value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></div>
                  <div><Label>תשלומים</Label><Input type="number" min="1" max="36" value={form.tash} onChange={(e) => setForm({ ...form, tash: e.target.value })} className="tabular" /></div>
                </div>
                <div><Label>תיאור חשבונית (heshDesc)</Label><Input dir="ltr" value={form.heshDesc} onChange={(e) => setForm({ ...form, heshDesc: e.target.value })} placeholder="[0~Item 1~1~8]" /></div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">אפשרויות</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.sendHesh} onChange={(e) => setForm({ ...form, sendHesh: e.target.checked })} className="size-4" /> שליחת חשבונית</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.sendemail} onChange={(e) => setForm({ ...form, sendemail: e.target.checked })} className="size-4" /> אימייל ללקוח</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.postpone} onChange={(e) => setForm({ ...form, postpone: e.target.checked })} className="size-4" /> חיוב דחוי</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.j5} onChange={(e) => setForm({ ...form, j5: e.target.checked })} className="size-4" /> J5 (שריון)</label>
                </div>
              </section>

              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                <CreditCard className="size-4" /> {loading ? "מחייב..." : "בצע חיוב"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>סכום החיוב</CardDescription>
              <CardTitle className="tabular text-3xl font-semibold">
                {COIN_SYMBOL[form.coin]}{amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1.5">
              <div className="flex justify-between"><span>תיאור</span><span className="text-foreground truncate max-w-[60%]">{form.info || "—"}</span></div>
              <div className="flex justify-between"><span>תשלומים</span><span className="text-foreground tabular">{form.tash}</span></div>
              {form.j5 && <div className="flex justify-between"><span>סוג</span><span>שריון (J5)</span></div>}
            </CardContent>
          </Card>

          {result && (
            <Card className={result.success ? "border-emerald-600/30" : "border-rose-600/30"}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  {result.success
                    ? <CheckCircle2 className="size-5 text-emerald-600" />
                    : <XCircle className="size-5 text-rose-600" />}
                  <span className="font-medium">{result.success ? "החיוב אושר" : "החיוב נכשל"}</span>
                  <Badge variant="secondary" className="ms-auto">{result.message}</Badge>
                </div>
                {result.result && (
                  <dl className="text-xs space-y-1.5 tabular">
                    {result.result.Id && <Field k="מספר עסקה" v={result.result.Id} />}
                    {result.result.ACode && <Field k="קוד אישור" v={result.result.ACode} />}
                    {result.result.Amount && <Field k="סכום" v={result.result.Amount} />}
                    {result.result.Payments && <Field k="תשלומים" v={result.result.Payments} />}
                    {result.result.L4digit && <Field k="כרטיס" v={`****${result.result.L4digit}`} />}
                    {result.result.Hesh && result.result.Hesh !== "0" && <Field k="חשבונית" v={result.result.Hesh} />}
                    {result.result.CCode && <Field k="קוד תשובה" v={result.result.CCode} />}
                  </dl>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/60 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
