"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { Copy, ExternalLink, Link2, Mail, MessageCircle, Smartphone, CreditCard } from "lucide-react";

import { clientDisplayName, hasValidName } from "@/lib/client-name";
import { getVatPercent, DEFAULT_VAT_PERCENT } from "./settings-tab";

interface Client { id: string; business_name: string; first_name: string; last_name: string; email: string; cell: string }

const COIN_SYMBOL: Record<string, string> = { "1": "₪", "2": "$", "3": "€", "4": "£" };

export function PaymentsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [form, setForm] = useState({
    amount: "", info: "", order: "", tash: "1", coin: "1",
    businessName: "", clientName: "", clientLName: "", userId: "", email: "", phone: "", cell: "",
    sendHesh: true, sendemail: true, hk: false, freq: "1", firstDate: "", postpone: false,
  });
  const [paymentUrl, setPaymentUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  // What the number in `form.amount` represents:
  //   gross  – amount already includes VAT (customer pays exactly this)
  //   net    – amount is before VAT; VAT gets added on top
  //   exempt – this transaction has no VAT at all (charity, export, etc.)
  const [amountMode, setAmountMode] = useState<"gross" | "net" | "exempt">("gross");
  const [vatPercent, setVatPercent] = useState<number>(DEFAULT_VAT_PERCENT);

  useEffect(() => { fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : [])); }, []);
  useEffect(() => { setVatPercent(getVatPercent()); }, []);

  const handleClientSelect = (id: string) => {
    setSelectedClient(id);
    if (id) {
      const c = clients.find((cl) => cl.id === id);
      if (c) setForm((f) => ({ ...f, businessName: c.business_name, clientName: c.first_name, clientLName: c.last_name, email: c.email, cell: c.cell }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient && !hasValidName({ business_name: form.businessName, first_name: form.clientName, last_name: form.clientLName })) {
      toast.error("יש להזין שם עסק או שם פרטי + שם משפחה");
      return;
    }
    setLoading(true); setPaymentUrl("");
    // Amount sent to Tranzila: gross if net-mode, as-typed otherwise.
    // vatExempt=true tells the invoice generator to use 0% VAT for this tx.
    const typed = parseFloat(form.amount);
    const grossAmount = amountMode === "net" ? +(typed * (1 + vatPercent / 100)).toFixed(2) : typed;
    const body: Record<string, unknown> = {
      amount: grossAmount, info: form.info, order: form.order,
      tash: parseInt(form.tash) || 1, coin: parseInt(form.coin),
      sendHesh: form.sendHesh, sendemail: form.sendemail, postpone: form.postpone,
      vatExempt: amountMode === "exempt",
    };
    if (selectedClient) body.clientId = selectedClient;
    else Object.assign(body, {
      businessName: form.businessName,
      clientName: form.clientName, clientLName: form.clientLName, userId: form.userId,
      email: form.email, phone: form.phone, cell: form.cell,
    });
    if (form.hk) Object.assign(body, {
      hk: true, freq: parseInt(form.freq), firstDate: form.firstDate, onlyOnApprove: true,
      tash: form.tash === "" ? 999 : parseInt(form.tash),
    });
    const res = await fetch("/api/payments/create-link", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.paymentUrl) {
      setPaymentUrl(data.paymentUrl);
      setShortUrl(data.shortUrl || "");
      toast.success(data.emailSent ? "הקישור מוכן — נשלח גם במייל ✓" : "הקישור מוכן");
    } else toast.error(data.error || "שגיאה ביצירת קישור");
    setLoading(false);
  };

  const handleCardUpdate = async () => {
    if (!selectedClient) { toast.error("בחר לקוח קיים לעדכון כרטיס"); return; }
    setLoading(true); setPaymentUrl("");
    const res = await fetch("/api/payments/create-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClient, cardUpdate: true, coin: parseInt(form.coin), sendemail: form.sendemail }),
    });
    const data = await res.json();
    if (data.shortUrl || data.paymentUrl) {
      setPaymentUrl(data.paymentUrl || data.shortUrl);
      setShortUrl(data.shortUrl || "");
      toast.success("קישור עדכון כרטיס מוכן");
    } else toast.error(data.error || "שגיאה ביצירת קישור");
    setLoading(false);
  };

  const activeClient = clients.find((c) => c.id === selectedClient);
  const shareEmail = activeClient?.email || form.email || "";
  const sharePhone = activeClient?.cell || form.cell || "";
  const shareName = activeClient ? clientDisplayName(activeClient) : (form.businessName || `${form.clientName} ${form.clientLName}`.trim());

  const handleShare = async (channel: string) => {
    setSharing(channel);
    try {
      const res = await fetch("/api/payments/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          paymentUrl: shortUrl || paymentUrl,
          clientName: shareName,
          clientEmail: shareEmail,
          clientPhone: sharePhone,
          amount: (() => {
            const typed = parseFloat(form.amount);
            if (!typed) return undefined;
            // Gross+exempt: charge exactly what was typed. Net: add VAT on top.
            return amountMode === "net" ? +(typed * (1 + vatPercent / 100)).toFixed(2) : typed;
          })(),
          currency: form.coin === "1" ? "ILS" : form.coin === "2" ? "USD" : form.coin === "3" ? "EUR" : "GBP",
          info: form.info,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || "שגיאה בשליחה"); }
      else { toast.success(channel === "email" ? "נשלח במייל" : channel === "whatsapp" ? "נשלח ב-WhatsApp" : "נשלח"); }
    } finally {
      setSharing(null);
    }
  };

  const amountNum = parseFloat(form.amount) || 0;

  return (
    <div>
      <Topbar
        title="קישור תשלום"
        description="הפק דף תשלום מאובטח של Tranzila ושלח ללקוח. תמיכה בתשלומים, חיוב דחוי והוראת קבע."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">לקוח</h3>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedClient} onChange={(e) => handleClientSelect(e.target.value)}
                >
                  <option value="">— הזנה ידנית —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{clientDisplayName(c)} · {c.email}</option>
                  ))}
                </select>

                {!selectedClient && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="col-span-2"><Label>שם עסק</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="או שם פרטי + שם משפחה" /></div>
                    <div><Label>שם פרטי</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
                    <div><Label>שם משפחה</Label><Input value={form.clientLName} onChange={(e) => setForm({ ...form, clientLName: e.target.value })} /></div>
                    <div><Label>{form.businessName.trim() ? "ח.פ." : "ת.ז."} *</Label><Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required={!selectedClient} /></div>
                    <div><Label>אימייל *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!selectedClient} /></div>
                    <div className="col-span-2"><Label>נייד *</Label><Input value={form.cell} onChange={(e) => setForm({ ...form, cell: e.target.value })} required={!selectedClient} /></div>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">עסקה</h3>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                      <Label>סכום *</Label>
                      <div className="flex text-[11px] rounded-md border border-input overflow-hidden">
                        <button type="button" onClick={() => setAmountMode("gross")}
                          className={`px-2 py-0.5 ${amountMode === "gross" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                          כולל מע״מ
                        </button>
                        <button type="button" onClick={() => setAmountMode("net")}
                          className={`px-2 py-0.5 border-r border-input ${amountMode === "net" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                          לפני מע״מ
                        </button>
                        <button type="button" onClick={() => setAmountMode("exempt")}
                          className={`px-2 py-0.5 border-r border-input ${amountMode === "exempt" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                          ללא מע״מ
                        </button>
                      </div>
                    </div>
                    <Input type="number" step="0.01" min="0.1" value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} required
                      className="tabular text-lg font-medium" />
                    {(() => {
                      const typed = parseFloat(form.amount) || 0;
                      if (typed <= 0) return null;
                      const sym = COIN_SYMBOL[form.coin] || "₪";
                      if (amountMode === "exempt") {
                        return (
                          <div className="mt-1 text-[11px] text-amber-700 tabular font-medium">
                            עסקה פטורה ממע״מ · לחיוב: {sym}{typed.toFixed(2)}
                          </div>
                        );
                      }
                      const gross = amountMode === "net" ? typed * (1 + vatPercent / 100) : typed;
                      const net = amountMode === "net" ? typed : typed / (1 + vatPercent / 100);
                      return (
                        <div className="mt-1 text-[11px] text-muted-foreground tabular">
                          {amountMode === "net"
                            ? <>כולל מע״מ ({vatPercent}%): <span className="font-medium text-foreground">{sym}{gross.toFixed(2)}</span></>
                            : <>לפני מע״מ ({vatPercent}%): <span className="font-medium text-foreground">{sym}{net.toFixed(2)}</span></>}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <Label>מטבע</Label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.coin} onChange={(e) => setForm({ ...form, coin: e.target.value })}>
                      <option value="1">₪ ILS</option>
                      <option value="2">$ USD</option>
                      <option value="3">€ EUR</option>
                      <option value="4">£ GBP</option>
                    </select>
                  </div>
                </div>
                <div><Label>תיאור עסקה *</Label><Input value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} placeholder="לדוגמה: ייעוץ חודשי" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>מספר הזמנה</Label><Input value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} placeholder="פנימי, לא חובה" /></div>
                  <div><Label>תשלומים</Label><Input type="number" min="1" max="36" value={form.tash} onChange={(e) => setForm({ ...form, tash: e.target.value })} className="tabular" /></div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">אפשרויות</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.sendHesh} onChange={(e) => setForm({ ...form, sendHesh: e.target.checked })} className="size-4 rounded border-input" /> שליחת חשבונית</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.sendemail} onChange={(e) => setForm({ ...form, sendemail: e.target.checked })} className="size-4 rounded border-input" /> אישור באימייל</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.postpone} onChange={(e) => setForm({ ...form, postpone: e.target.checked })} className="size-4 rounded border-input" /> חיוב דחוי (J5)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.hk} onChange={(e) => setForm({ ...form, hk: e.target.checked })} className="size-4 rounded border-input" /> הוראת קבע</label>
                </div>
                {form.hk && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-accent/40 border border-border">
                    <div><Label>תדירות (חודשים)</Label><Input type="number" min="1" value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value })} /></div>
                    <div><Label>תאריך ראשון</Label><Input type="date" value={form.firstDate} onChange={(e) => setForm({ ...form, firstDate: e.target.value })} /></div>
                  </div>
                )}
              </section>

              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                <Link2 className="size-4" />
                {loading ? "מפיק קישור..." : "הפק קישור תשלום"}
              </Button>
              <Button type="button" variant="outline" className="w-full gap-2" disabled={loading}
                onClick={handleCardUpdate}
                title="הלקוח יזין כרטיס שיישמר לחיובים עתידיים — ללא חיוב כעת">
                <CreditCard className="size-4" />
                קישור עדכון כרטיס (ללא חיוב)
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>סיכום</CardDescription>
              <CardTitle className="tabular text-3xl font-semibold">
                {COIN_SYMBOL[form.coin]}{amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="לקוח" v={(() => { const c = clients.find((x) => x.id === selectedClient); return c ? clientDisplayName(c) : (form.businessName || `${form.clientName} ${form.clientLName}`.trim() || "—"); })()} />
              <Row k="תיאור" v={form.info || "—"} />
              <Row k="תשלומים" v={form.tash} />
              {form.hk && <Row k="הוראת קבע" v={`כל ${form.freq} חודשים`} />}
              {form.postpone && <Row k="חיוב" v="דחוי (J5)" />}
            </CardContent>
          </Card>

          {paymentUrl ? (
            <Card>
              <CardHeader><CardTitle className="text-base">קישור מוכן — שלח ללקוח</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {shortUrl && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50/60 px-3 py-2">
                    <Link2 className="size-3.5 shrink-0 text-green-600" />
                    <span className="text-xs font-mono break-all text-green-800 flex-1" dir="ltr">{shortUrl}</span>
                    <button
                      className="shrink-0 text-xs text-green-700 hover:text-green-900 underline"
                      onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("הקישור הקצר הועתק"); }}
                    >העתק</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(shortUrl || paymentUrl); toast.success("הועתק"); }}>
                    <Copy className="size-4" /> העתק
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(shortUrl || paymentUrl, "_blank")}>
                    <ExternalLink className="size-4" /> פתח
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50 disabled:opacity-50"
                    disabled={!sharePhone || sharing === "whatsapp"}
                    title={!sharePhone ? "אין מספר טלפון ללקוח" : ""}
                    onClick={() => handleShare("whatsapp")}
                  >
                    <MessageCircle className="size-4" />
                    {sharing === "whatsapp" ? "שולח..." : "WhatsApp"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="disabled:opacity-50"
                    disabled={!shareEmail || sharing === "email"}
                    title={!shareEmail ? "אין אימייל ללקוח" : ""}
                    onClick={() => handleShare("email")}
                  >
                    <Mail className="size-4" />
                    {sharing === "email" ? "שולח..." : "מייל"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="col-span-2 text-muted-foreground opacity-50 cursor-not-allowed"
                    disabled
                    title="SMS בקרוב"
                  >
                    <Smartphone className="size-4" /> SMS (בקרוב)
                  </Button>
                </div>
                {(!sharePhone && !shareEmail) && (
                  <p className="text-xs text-amber-600">בחר לקוח קיים או הזן אימייל/טלפון לאפשרויות שליחה.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                מלא פרטים → הקישור יופיע כאן.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );
}
