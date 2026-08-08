"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { Plus, Search, Download, Upload, Trash2, KeyRound, Users, Pencil, Copy, ExternalLink, Receipt } from "lucide-react";
import { clientDisplayName, hasValidName } from "@/lib/client-name";

interface Client {
  id: string;
  business_name: string;
  first_name: string; last_name: string;
  user_id: string; email: string;
  phone: string; cell: string;
  street?: string; city?: string; zip?: string;
  token?: string | null; token_exp_month?: string | null; token_exp_year?: string | null; l4digit?: string | null;
  created_at: string;
}

const emptyForm = {
  businessName: "", firstName: "", lastName: "", userId: "", email: "",
  phone: "", cell: "", street: "", city: "", zip: "",
};

export function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [tokenDialog, setTokenDialog] = useState<{ open: boolean; clientId: string }>({ open: false, clientId: "" });
  const [editDialog, setEditDialog] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [editForm, setEditForm] = useState(emptyForm);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [clientTxs, setClientTxs] = useState<Array<{ id: string; yaad_id: string; amount: number; coin: number; status: string; type: string; info: string; created_at: string; payment_url?: string }>>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [tranzilaToken, setTranzilaToken] = useState("");
  const [tranzilaExpdate, setTranzilaExpdate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchClients = () => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchClients(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidName({ business_name: form.businessName, first_name: form.firstName, last_name: form.lastName })) {
      toast.error("יש להזין שם עסק או שם פרטי + שם משפחה");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("לקוח נוצר");
      setForm(emptyForm); setDialogOpen(false); fetchClients();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "שגיאה ביצירה");
    }
    setSaving(false);
  };

  const openDetail = async (c: Client) => {
    setDetailClient(c);
    setTxLoading(true);
    try {
      const r = await fetch("/api/transactions?limit=500");
      const all = await r.json();
      setClientTxs(Array.isArray(all) ? all.filter((t: { client_id: string | null }) => t.client_id === c.id) : []);
    } finally { setTxLoading(false); }
  };

  const openEdit = (c: Client) => {
    setEditForm({
      businessName: c.business_name || "",
      firstName: c.first_name, lastName: c.last_name, userId: c.user_id, email: c.email,
      phone: c.phone || "", cell: c.cell, street: c.street || "", city: c.city || "", zip: c.zip || "",
    });
    setEditDialog({ open: true, client: c });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDialog.client) return;
    if (!hasValidName({ business_name: editForm.businessName, first_name: editForm.firstName, last_name: editForm.lastName })) {
      toast.error("יש להזין שם עסק או שם פרטי + שם משפחה");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editDialog.client.id, ...editForm }),
    });
    if (res.ok) { toast.success("עודכן"); setEditDialog({ open: false, client: null }); fetchClients(); }
    else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "שגיאה בעדכון");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`למחוק את ${name}? לא ניתן לבטל.`)) return;
    await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
    toast.success("נמחק"); fetchClients();
  };

  const handleSaveToken = async () => {
    if (!tranzilaToken || !tranzilaExpdate) return;
    const res = await fetch("/api/tokens", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: tokenDialog.clientId, token: tranzilaToken, expdate: tranzilaExpdate }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("טוקן נשמר בהצלחה");
      setTokenDialog({ open: false, clientId: "" }); setTranzilaToken(""); setTranzilaExpdate(""); fetchClients();
    } else toast.error(data.error || data.message);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const res = await fetch("/api/clients/csv", { method: "POST", body: text, headers: { "Content-Type": "text/csv" } });
    const data = await res.json();
    if (res.ok) {
      toast.success(`יובאו ${data.created} · עודכנו ${data.updated} · דולגו ${data.skipped}`);
      fetchClients();
    } else toast.error("שגיאה בייבוא");
  };

  const filtered = clients.filter((c) =>
    !q || `${c.business_name} ${c.first_name} ${c.last_name} ${c.email} ${c.cell}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <Topbar
        title="לקוחות"
        description="ניהול כרטיסי לקוח, פרטי תשלום וטוקנים שמורים."
        actions={
          <>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> ייבוא
            </Button>
            <Button variant="outline" size="sm" render={<a href="/api/clients/csv" download />}>
              <Download className="size-4" /> ייצוא
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-2"><Plus className="size-4" />לקוח חדש</Button>} />
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>הוספת לקוח</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>שם עסק</Label>
                    <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="או הזן שם פרטי + שם משפחה למטה" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>שם פרטי</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                    <div><Label>שם משפחה</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">חובה למלא שם עסק או שם פרטי + שם משפחה.</p>
                  {form.businessName.trim() && (
                    <div><Label>ח.פ.</Label><Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="מספר חברה" /></div>
                  )}
                  <div><Label>אימייל *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>טלפון</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>נייד *</Label><Input value={form.cell} onChange={(e) => setForm({ ...form, cell: e.target.value })} required /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>רחוב</Label><Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
                    <div><Label>עיר</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                    <div><Label>מיקוד</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>{saving ? "שומר..." : "צור לקוח"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Sheet open={!!detailClient} onOpenChange={(o) => !o && setDetailClient(null)}>
        <SheetContent className="sm:!max-w-lg p-0 flex flex-col" side="left">
          <SheetHeader className="border-b">
            <SheetTitle>{detailClient ? clientDisplayName(detailClient) : ""}</SheetTitle>
          </SheetHeader>
          {detailClient && (
            <div className="p-4 space-y-4 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3">
                {detailClient.business_name?.trim() && (
                  <div><div className="text-xs text-muted-foreground">ח.פ.</div><div className="tabular">{detailClient.user_id || "—"}</div></div>
                )}
                <div><div className="text-xs text-muted-foreground">אימייל</div><div>{detailClient.email}</div></div>
                <div><div className="text-xs text-muted-foreground">נייד</div><div className="tabular" dir="ltr">{detailClient.cell}</div></div>
                <div><div className="text-xs text-muted-foreground">טלפון</div><div className="tabular" dir="ltr">{detailClient.phone || "—"}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">כתובת</div><div>{[detailClient.street, detailClient.city, detailClient.zip].filter(Boolean).join(", ") || "—"}</div></div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">טוקן</div>
                  {detailClient.token ? (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 tabular">
                      ****{detailClient.token.slice(-4)} · {detailClient.token_exp_month}/{detailClient.token_exp_year}
                    </Badge>
                  ) : <Badge variant="secondary" className="bg-muted text-muted-foreground ring-1 ring-border">אין</Badge>}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => { setDetailClient(null); openEdit(detailClient); }}>
                  <Pencil className="size-3.5" /> ערוך
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDetailClient(null); setTokenDialog({ open: true, clientId: detailClient.id }); }}>
                  <KeyRound className="size-3.5" /> {detailClient.token ? "החלף טוקן" : "טוקן"}
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => { setDetailClient(null); handleDelete(detailClient.id, clientDisplayName(detailClient)); }}>
                  <Trash2 className="size-3.5" /> מחק
                </Button>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Receipt className="size-3.5" /> עסקאות ({clientTxs.length})
                </div>
                {txLoading ? (
                  <div className="space-y-1">{[0, 1, 2].map((i) => <div key={i} className="h-8 bg-muted/60 rounded animate-pulse" />)}</div>
                ) : clientTxs.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">אין עסקאות</div>
                ) : (
                  <div className="space-y-2">
                    {clientTxs.map((tx) => {
                      const sym = ({ 1: "₪", 2: "$", 3: "€", 4: "£" } as Record<number, string>)[tx.coin] || "₪";
                      return (
                        <div key={tx.id} className="rounded border p-2 text-xs flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono tabular text-[11px]" dir="ltr">{tx.yaad_id || tx.id.slice(0, 8)}</div>
                            <div className="text-muted-foreground truncate">{tx.info}</div>
                            <div className="text-muted-foreground tabular">{new Date(tx.created_at).toLocaleDateString("he-IL")}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-medium tabular">{tx.type === "refund" ? "−" : ""}{sym}{tx.amount.toLocaleString()}</div>
                            <Badge variant="secondary" className="text-[10px]">{tx.status}</Badge>
                            {tx.payment_url && (
                              <div className="flex gap-1">
                                <button title="העתק לינק" onClick={() => { navigator.clipboard.writeText(tx.payment_url!); toast.success("הועתק"); }} className="text-muted-foreground hover:text-foreground">
                                  <Copy className="size-3" />
                                </button>
                                <a title="פתח לינק" href={tx.payment_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                                  <ExternalLink className="size-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>עריכת לקוח</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>שם עסק</Label>
              <Input value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>שם פרטי</Label><Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} /></div>
              <div><Label>שם משפחה</Label><Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">חובה למלא שם עסק או שם פרטי + שם משפחה.</p>
            {editForm.businessName.trim() && (
              <div><Label>ח.פ.</Label><Input value={editForm.userId} onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })} placeholder="מספר חברה" /></div>
            )}
            <div><Label>אימייל *</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>טלפון</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div><Label>נייד *</Label><Input value={editForm.cell} onChange={(e) => setEditForm({ ...editForm, cell: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>רחוב</Label><Input value={editForm.street} onChange={(e) => setEditForm({ ...editForm, street: e.target.value })} /></div>
              <div><Label>עיר</Label><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
              <div><Label>מיקוד</Label><Input value={editForm.zip} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tokenDialog.open} onOpenChange={(open) => setTokenDialog({ ...tokenDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>שמירת טוקן Tranzila</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">הטוקן נשמר אוטומטית לאחר תשלום. להזנה ידנית — הזן TranzilaTK ותאריך תפוגה (MMYY).</p>
            <div><Label>TranzilaTK</Label><Input dir="ltr" value={tranzilaToken} onChange={(e) => setTranzilaToken(e.target.value)} placeholder="1234567890abcdef" /></div>
            <div><Label>תאריך תפוגה (MMYY)</Label><Input dir="ltr" maxLength={4} value={tranzilaExpdate} onChange={(e) => setTranzilaExpdate(e.target.value)} placeholder="0128" /></div>
            <Button onClick={handleSaveToken} className="w-full" disabled={!tranzilaToken || tranzilaExpdate.length !== 4}>שמור טוקן</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם, אימייל או נייד" className="pr-9" />
        </div>
        <div className="text-xs text-muted-foreground tabular ms-auto">{filtered.length} מתוך {clients.length}</div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="size-8 mx-auto text-muted-foreground/60" />
              <div className="mt-3 text-base font-medium">{clients.length === 0 ? "אין לקוחות עדיין" : "לא נמצאו לקוחות"}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {clients.length === 0 ? "הוסף לקוח ידנית או ייבא רשימה מ-CSV." : "נסה ביטוי חיפוש אחר."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>ח.פ.</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>נייד</TableHead>
                  <TableHead>טוקן</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                    <TableCell className="font-medium">{clientDisplayName(c)}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{c.business_name?.trim() ? (c.user_id || "—") : ""}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="tabular text-muted-foreground" dir="ltr">{c.cell}</TableCell>
                    <TableCell>
                      {c.token ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 tabular">
                          ****{c.token.slice(-4)} · {c.token_exp_month}/{c.token_exp_year}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground ring-1 ring-border">אין</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left space-x-1 space-x-reverse" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => setTokenDialog({ open: true, clientId: c.id })}>
                        <KeyRound className="size-3.5" /> {c.token ? "החלף" : "טוקן"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => handleDelete(c.id, clientDisplayName(c))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
