"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { RotateCw, Download, Search, Receipt, Undo2, CheckCheck, XCircle, Trash2, Pencil, Copy, ExternalLink, User } from "lucide-react";

interface TxClient { business_name?: string; first_name: string; last_name: string; email: string }
interface Transaction {
  id: string; yaad_id: string; client_id: string | null;
  amount: number; coin: number; status: string;
  ccode: string; acode?: string; info: string; hesh?: string;
  type: string; created_at: string;
  l4digit?: string; brand?: string; bank?: string;
  payment_url?: string;
  invoice_url?: string;
  client?: TxClient | null;
}

const coinSymbol: Record<number, string> = { 1: "₪", 2: "$", 3: "€", 4: "£" };
const statusLabel: Record<string, string> = {
  approved: "אושר", pending: "ממתין", cancelled: "בוטל",
  refunded: "זוכה", postponed: "דחוי", failed: "נכשל",
};
const typeLabel: Record<string, string> = {
  payment: "תשלום", charge: "חיוב", refund: "זיכוי", subscription: "הו״ק",
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

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "הכל" },
  { value: "approved", label: "אושרו" },
  { value: "postponed", label: "דחויות" },
  { value: "pending", label: "ממתינות" },
  { value: "refunded", label: "זוכו" },
  { value: "failed", label: "נכשלו" },
];

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [refundAmount, setRefundAmount] = useState("");
  const [commitDialog, setCommitDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [commitHeshDesc, setCommitHeshDesc] = useState("");
  const [editDialog, setEditDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [editForm, setEditForm] = useState({ info: "", amount: "", status: "" });
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const fetchTransactions = () => {
    setLoading(true);
    fetch("/api/transactions").then((r) => r.json()).then((d) => setTransactions(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchTransactions(); }, []);

  const handleCancel = async (yaadId: string) => {
    if (!confirm("לבטל את העסקה? פעולה זו בלתי הפיכה.")) return;
    const res = await fetch("/api/payments/cancel", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transId: yaadId }),
    });
    const data = await res.json();
    if (data.success) { toast.success("העסקה בוטלה"); fetchTransactions(); } else toast.error(data.message);
  };

  const handleRefund = async () => {
    if (!refundDialog.tx) return;
    const res = await fetch("/api/payments/refund", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transId: refundDialog.tx.yaad_id, amount: parseFloat(refundAmount), sendHesh: true }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("הזיכוי בוצע"); setRefundDialog({ open: false, tx: null }); setRefundAmount(""); fetchTransactions();
    } else toast.error(data.message);
  };

  const handleCommit = async () => {
    if (!commitDialog.tx) return;
    const res = await fetch("/api/payments/commit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transId: commitDialog.tx.yaad_id, sendHesh: true, heshDesc: commitHeshDesc || undefined }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("העסקה אושרה"); setCommitDialog({ open: false, tx: null }); setCommitHeshDesc(""); fetchTransactions();
    } else toast.error(data.message);
  };

  const handleDeleteRow = async (tx: Transaction) => {
    if (!confirm(`למחוק שורת לוג של עסקה ${tx.yaad_id || tx.id}?\nשים לב: זו מחיקה מקומית בלבד — לא משפיעה על Tranzila.`)) return;
    const res = await fetch(`/api/transactions?id=${tx.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("נמחק מהלוג"); fetchTransactions(); }
    else toast.error("שגיאה במחיקה");
  };

  const openEdit = (tx: Transaction) => {
    setEditForm({ info: tx.info || "", amount: String(tx.amount), status: tx.status });
    setEditDialog({ open: true, tx });
  };

  const handleEdit = async () => {
    if (!editDialog.tx) return;
    const res = await fetch("/api/transactions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editDialog.tx.id,
        info: editForm.info,
        amount: parseFloat(editForm.amount),
        status: editForm.status,
      }),
    });
    if (res.ok) { toast.success("עודכן"); setEditDialog({ open: false, tx: null }); fetchTransactions(); }
    else toast.error("שגיאה בעדכון");
  };

  const filtered = transactions.filter((tx) => {
    if (statusFilter && tx.status !== statusFilter) return false;
    if (!q) return true;
    const clientText = tx.client
      ? `${tx.client.business_name || ""} ${tx.client.first_name || ""} ${tx.client.last_name || ""} ${tx.client.email || ""}`
      : "";
    return `${tx.info} ${tx.yaad_id} ${tx.status} ${clientText}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <Topbar
        title="עסקאות"
        description="היסטוריה, סינון, וביצוע פעולות (זיכוי, ביטול, אישור עסקה דחויה)."
        actions={
          <>
            <Button variant="outline" size="sm" render={<a href="/api/transactions/csv" download />}>
              <Download className="size-4" /> ייצוא CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchTransactions}>
              <RotateCw className="size-4" /> רענן
            </Button>
          </>
        }
      />

      <Dialog open={refundDialog.open} onOpenChange={(open) => setRefundDialog({ ...refundDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>זיכוי עסקה #{refundDialog.tx?.yaad_id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">סכום מקורי: <span className="tabular font-medium text-foreground">{coinSymbol[refundDialog.tx?.coin || 1]}{refundDialog.tx?.amount}</span></p>
            <div>
              <Label>סכום לזיכוי</Label>
              <Input type="number" step="0.01" min="0.01" max={refundDialog.tx?.amount} value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)} className="tabular" />
            </div>
            <Button onClick={handleRefund} className="w-full gap-2"><Undo2 className="size-4" />בצע זיכוי</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={commitDialog.open} onOpenChange={(open) => setCommitDialog({ ...commitDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>אישור עסקה דחויה #{commitDialog.tx?.yaad_id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">סכום: <span className="tabular font-medium text-foreground">{coinSymbol[commitDialog.tx?.coin || 1]}{commitDialog.tx?.amount}</span></p>
            <div><Label>תיאור חשבונית (אופציונלי)</Label><Input value={commitHeshDesc} onChange={(e) => setCommitHeshDesc(e.target.value)} /></div>
            <Button onClick={handleCommit} className="w-full gap-2"><CheckCheck className="size-4" />אשר עסקה</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailTx} onOpenChange={(o) => !o && setDetailTx(null)}>
        <SheetContent className="sm:!max-w-md p-0 flex flex-col" side="left">
          <SheetHeader className="border-b">
            <SheetTitle>פרטי עסקה</SheetTitle>
          </SheetHeader>
          {detailTx && (
            <div className="p-4 space-y-4 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">מספר Tranzila</div><div className="font-mono tabular" dir="ltr">{detailTx.yaad_id || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">סטטוס</div><Badge variant="secondary" className={`ring-1 ${statusTone(detailTx.status)}`}>{statusLabel[detailTx.status] || detailTx.status}</Badge></div>
                <div><div className="text-xs text-muted-foreground">סוג</div><div>{typeLabel[detailTx.type] || detailTx.type}</div></div>
                <div><div className="text-xs text-muted-foreground">סכום</div><div className="tabular font-medium">{coinSymbol[detailTx.coin] || "₪"}{detailTx.amount.toLocaleString()}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">תיאור</div><div>{detailTx.info || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">כרטיס</div><div className="tabular" dir="ltr">{detailTx.l4digit ? `****${detailTx.l4digit}` : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">חשבונית</div><div className="tabular">{detailTx.hesh && detailTx.hesh !== "0" ? `#${detailTx.hesh}` : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">CCode</div><div className="tabular">{detailTx.ccode || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">ACode</div><div className="tabular">{detailTx.acode || "—"}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">תאריך</div><div>{new Date(detailTx.created_at).toLocaleString("he-IL")}</div></div>
              </div>

              {detailTx.client && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><User className="size-3.5" /> לקוח מקושר</div>
                  <div className="font-medium">{detailTx.client.business_name?.trim() || `${detailTx.client.first_name} ${detailTx.client.last_name}`.trim()}</div>
                  <div className="text-muted-foreground">{detailTx.client.email}</div>
                </div>
              )}

              {detailTx.payment_url ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">לינק תשלום</div>
                  <div className="font-mono text-[11px] break-all bg-muted p-2 rounded" dir="ltr">{detailTx.payment_url}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detailTx.payment_url!); toast.success("הועתק"); }}>
                      <Copy className="size-3.5" /> העתק
                    </Button>
                    <Button size="sm" variant="outline" render={<a href={detailTx.payment_url} target="_blank" rel="noreferrer" />}>
                      <ExternalLink className="size-3.5" /> פתח
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">אין לינק תשלום שמור (עסקה ישנה או חיוב ישיר).</div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>עריכת עסקה #{editDialog.tx?.yaad_id || editDialog.tx?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">עדכון לוג מקומי בלבד. לא משפיע על Tranzila.</p>
            <div><Label>תיאור</Label><Input value={editForm.info} onChange={(e) => setEditForm({ ...editForm, info: e.target.value })} /></div>
            <div><Label>סכום</Label><Input type="number" step="0.01" className="tabular" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
            <div>
              <Label>סטטוס</Label>
              <select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <Button onClick={handleEdit} className="w-full">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי תיאור או מספר" className="pr-9" />
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${statusFilter === f.value ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >{f.label}</button>
          ))}
        </div>
        <div className="ms-auto text-xs text-muted-foreground tabular">{filtered.length} / {transactions.length}</div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="size-8 mx-auto text-muted-foreground/60" />
              <div className="mt-3 text-base font-medium">
                {transactions.length === 0 ? "אין עסקאות עדיין" : "אין עסקאות תואמות"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {transactions.length === 0 ? "צור קישור תשלום או בצע חיוב ראשון." : "נסה לשנות סינון."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר</TableHead>
                  <TableHead>לקוח / עסק</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead className="text-end">סכום</TableHead>
                  <TableHead>כרטיס</TableHead>
                  <TableHead>חשבונית</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => (
                  <TableRow key={tx.id} className="cursor-pointer" onClick={() => setDetailTx(tx)}>
                    <TableCell className="font-mono text-xs tabular" dir="ltr">{tx.yaad_id || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {tx.client
                        ? (tx.client.business_name?.trim() || `${tx.client.first_name} ${tx.client.last_name}`.trim() || "—")
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`ring-1 ${statusTone(tx.status)}`}>
                        {statusLabel[tx.status] || tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{typeLabel[tx.type] || tx.type}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">{tx.info}</TableCell>
                    <TableCell className="font-medium tabular text-end whitespace-nowrap">
                      {tx.type === "refund" ? "−" : ""}{coinSymbol[tx.coin] || "₪"}{tx.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular text-muted-foreground" dir="ltr">{tx.l4digit ? `****${tx.l4digit}` : "—"}</TableCell>
                    <TableCell className="text-xs tabular text-muted-foreground">{tx.hesh && tx.hesh !== "0" ? `#${tx.hesh}` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString("he-IL")}
                      <span className="text-muted-foreground/70"> · </span>
                      {new Date(tx.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-left space-x-1 space-x-reverse whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {tx.status === "approved" && tx.yaad_id && (
                        <>
                          <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800"
                            title={tx.hesh && tx.hesh !== "0"
                              ? "שלח חשבונית קיימת במייל ללקוח (shift+קליק ליצירת חשבונית חדשה)"
                              : "צור ושלח חשבונית"}
                            onClick={async (e) => {
                              const alreadyInvoiced = tx.hesh && tx.hesh !== "0";
                              const force = e.shiftKey;

                              if (alreadyInvoiced && force) {
                                if (!confirm(`כבר קיימת חשבונית #${tx.hesh} עבור עסקה זו.\nליצור חשבונית נוספת (תיקון)?`)) return;
                              }

                              // Resend existing invoice by email
                              if (alreadyInvoiced && !force) {
                                const res = await fetch("/api/invoices/resend", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ transId: tx.yaad_id }),
                                });
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) { toast.error(j.error || "שגיאה בשליחת מייל"); return; }
                                toast.success(`חשבונית #${tx.hesh} נשלחה במייל ללקוח`);
                                return;
                              }

                              // Create new invoice (or force re-issue)
                              const res = await fetch("/api/invoices", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ transId: tx.yaad_id, force }),
                              });
                              const j = await res.json().catch(() => ({}));
                              if (!res.ok) { toast.error(j.error || "שגיאה בשליחת חשבונית"); return; }
                              toast.success(`חשבונית נשלחה (#${j.docNumber})`);
                              fetchTransactions();
                            }}>
                            <Receipt className="size-3.5" />
                            {tx.hesh && tx.hesh !== "0" ? `שלח #${tx.hesh}` : "חשבונית"}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700"
                            onClick={() => { setRefundAmount(tx.amount.toString()); setRefundDialog({ open: true, tx }); }}>
                            <Undo2 className="size-3.5" />זיכוי
                          </Button>
                          <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => handleCancel(tx.yaad_id)}>
                            <XCircle className="size-3.5" />ביטול
                          </Button>
                        </>
                      )}
                      {tx.status === "postponed" && tx.yaad_id && (
                        <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700" onClick={() => setCommitDialog({ open: true, tx })}>
                          <CheckCheck className="size-3.5" />אשר
                        </Button>
                      )}
                      {tx.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(tx)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => handleDeleteRow(tx)}>
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
