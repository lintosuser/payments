"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { RotateCw, Plus, Pause, Play, Trash2, Pencil } from "lucide-react";
import { clientDisplayName } from "@/lib/client-name";

interface Sub {
  id: string; client_id: string; client_name: string; client_email: string; client_has_token: boolean;
  amount: number; coin: number; info: string; freq_months: number;
  next_charge: string; active: boolean; created_at: string;
}

interface Client { id: string; business_name: string; first_name: string; last_name: string; email: string; token: string | null }

const COIN: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };

const emptyForm = { clientId: "", amount: "", coin: "1", info: "", freqMonths: "1", nextCharge: "" };

type SubFormValues = { amount: string; coin: string; info: string; freqMonths: string; nextCharge: string };

function SubFormFields({ f, setF }: { f: SubFormValues; setF: (v: SubFormValues) => void }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div>
          <Label>סכום *</Label>
          <Input type="number" step="0.01" min="0.1" value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            className="tabular" required />
        </div>
        <div>
          <Label>מטבע</Label>
          <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={f.coin} onChange={(e) => setF({ ...f, coin: e.target.value })}>
            <option value="1">₪ ILS</option>
            <option value="2">$ USD</option>
            <option value="3">€ EUR</option>
            <option value="4">£ GBP</option>
          </select>
        </div>
      </div>
      <div>
        <Label>תיאור חיוב *</Label>
        <Input value={f.info} onChange={(e) => setF({ ...f, info: e.target.value })}
          placeholder="לדוגמה: דמי שירות חודשיים" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>תדירות (חודשים) *</Label>
          <Input type="number" min="1" max="12" value={f.freqMonths}
            onChange={(e) => setF({ ...f, freqMonths: e.target.value })}
            className="tabular" required />
        </div>
        <div>
          <Label>תאריך חיוב הבא *</Label>
          <Input type="date" value={f.nextCharge}
            onChange={(e) => setF({ ...f, nextCharge: e.target.value })} required />
        </div>
      </div>
    </>
  );
}

export function SubscriptionsTab() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSub, setEditSub] = useState<Sub | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ amount: "", coin: "1", info: "", freqMonths: "1", nextCharge: "" });
  const [saving, setSaving] = useState(false);

  const fetchSubs = () => {
    setLoading(true);
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((d) => setSubs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubs();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        amount: parseFloat(form.amount),
        coin: parseInt(form.coin),
        info: form.info,
        freqMonths: parseInt(form.freqMonths),
        nextCharge: form.nextCharge,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(j.error || "שגיאה ביצירת הוראת קבע"); return; }
    toast.success("הוראת קבע נוצרה");
    setCreateOpen(false);
    setForm(emptyForm);
    fetchSubs();
  };

  const openEdit = (sub: Sub) => {
    setEditForm({
      amount: String(sub.amount),
      coin: String(sub.coin),
      info: sub.info,
      freqMonths: String(sub.freq_months),
      nextCharge: sub.next_charge,
    });
    setEditSub(sub);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSub) return;
    setSaving(true);
    const res = await fetch(`/api/subscriptions/${editSub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(editForm.amount),
        coin: parseInt(editForm.coin),
        info: editForm.info,
        freqMonths: parseInt(editForm.freqMonths),
        nextCharge: editForm.nextCharge,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(j.error || "שגיאה בעדכון"); return; }
    toast.success("הוראת קבע עודכנה");
    setEditSub(null);
    fetchSubs();
  };

  const toggleActive = async (sub: Sub) => {
    const res = await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !sub.active }),
    });
    if (res.ok) { toast.success(sub.active ? "הוראת קבע הושהתה" : "הוראת קבע הופעלה"); fetchSubs(); }
    else toast.error("שגיאה");
  };

  const handleDelete = async (sub: Sub) => {
    if (!confirm(`למחוק את הוראת הקבע עבור ${sub.client_name}?\nפעולה זו אינה ניתנת לביטול.`)) return;
    const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("הוראת קבע נמחקה"); fetchSubs(); }
    else toast.error("שגיאה במחיקה");
  };

  const clientsWithToken = clients.filter((c) => c.token);
  const selectedClient = clients.find((c) => c.id === form.clientId);
  const active = subs.filter((s) => s.active);
  const inactive = subs.filter((s) => !s.active);

  return (
    <div>
      <Topbar
        title="הוראות קבע"
        description="חיוב אוטומטי חודשי ללקוחות עם טוקן שמור. הריצה מתבצעת כל יום ב-08:00."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchSubs}><RotateCw className="size-4" /> רענן</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> הוראת קבע חדשה</Button>
          </>
        }
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>הוראת קבע חדשה</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>לקוח (עם טוקן שמור) *</Label>
              <select
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required
              >
                <option value="">— בחר לקוח —</option>
                {clientsWithToken.map((c) => (
                  <option key={c.id} value={c.id}>{clientDisplayName(c)} · {c.email}</option>
                ))}
              </select>
              {clients.length > 0 && clientsWithToken.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">אין לקוחות עם טוקן שמור. שלח ללקוח קישור תשלום תחילה.</p>
              )}
              {selectedClient && !selectedClient.token && (
                <p className="text-xs text-amber-600 mt-1">ללקוח זה אין טוקן שמור.</p>
              )}
            </div>
            <SubFormFields f={{ amount: form.amount, coin: form.coin, info: form.info, freqMonths: form.freqMonths, nextCharge: form.nextCharge }}
              setF={(v) => setForm({ ...form, ...v })} />
            <Button type="submit" className="w-full" disabled={saving || !form.clientId}>
              {saving ? "יוצר..." : "צור הוראת קבע"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editSub} onOpenChange={(o) => !o && setEditSub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת הוראת קבע — {editSub?.client_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <SubFormFields f={editForm} setF={setEditForm} />
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <SubTable title="פעילות" subs={active} loading={loading}
          onToggle={toggleActive} onDelete={handleDelete} onEdit={openEdit} />
        {inactive.length > 0 && (
          <SubTable title="מושהות / בוטלו" subs={inactive} loading={false}
            onToggle={toggleActive} onDelete={handleDelete} onEdit={openEdit} />
        )}
      </div>
    </div>
  );
}

function SubTable({ title, subs, loading, onToggle, onDelete, onEdit }: {
  title: string; subs: Sub[]; loading: boolean;
  onToggle: (s: Sub) => void; onDelete: (s: Sub) => void; onEdit: (s: Sub) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <div className="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">{title}</div>
      <CardContent className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />)}</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">אין הוראות קבע</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                <TableHead className="text-end">סכום</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>תדירות</TableHead>
                <TableHead>חיוב הבא</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((sub) => {
                const overdue = sub.active && sub.next_charge < today;
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{sub.client_name}</div>
                      <div className="text-xs text-muted-foreground">{sub.client_email}</div>
                    </TableCell>
                    <TableCell className="tabular font-medium text-end whitespace-nowrap">
                      {COIN[sub.coin] || "₪"}{Number(sub.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{sub.info}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      כל {sub.freq_months === 1 ? "חודש" : `${sub.freq_months} חודשים`}
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      <span className={overdue ? "text-rose-600 font-medium" : ""}>
                        {sub.next_charge}
                        {overdue && <span className="text-xs mr-1">(באיחור)</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={sub.active
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                        : "bg-muted text-muted-foreground ring-1 ring-border"}>
                        {sub.active ? "פעיל" : "מושהה"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left whitespace-nowrap space-x-1 space-x-reverse">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(sub)} title="ערוך">
                        <Pencil className="size-3.5 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onToggle(sub)}
                        title={sub.active ? "השהה" : "הפעל"}>
                        {sub.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700"
                        onClick={() => onDelete(sub)} title="מחק">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
