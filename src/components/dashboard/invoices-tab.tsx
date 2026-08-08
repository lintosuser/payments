"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Topbar } from "./topbar";
import { FileText, Copy, ExternalLink, Info } from "lucide-react";

export function InvoicesTab() {
  const [form, setForm] = useState({ transId: "", asm: "", type: "PDF" as "PDF" | "HTML" | "NEW" });
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setInvoiceUrl("");
    const res = await fetch("/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transId: form.transId || undefined, asm: form.asm || undefined, type: form.type }),
    });
    const data = await res.json();
    if (data.invoiceUrl) { setInvoiceUrl(data.invoiceUrl); toast.success("חשבונית מוכנה"); }
    else toast.error(data.error || "שגיאה");
    setLoading(false);
  };

  return (
    <div>
      <Topbar title="חשבוניות" description="הפקה ושליפה של חשבוניות לפי מספר עסקה או מספר חשבונית." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div>
                <Label>מספר עסקה</Label>
                <Input dir="ltr" className="tabular" value={form.transId} onChange={(e) => setForm({ ...form, transId: e.target.value })} placeholder="לדוגמה: 12788261" />
                <p className="mt-1 text-xs text-muted-foreground">מספר עסקה מ-Tranzila (index).</p>
              </div>
              <div>
                <Label>מספר חשבונית (ASM)</Label>
                <Input dir="ltr" className="tabular" value={form.asm} onChange={(e) => setForm({ ...form, asm: e.target.value })} placeholder="לדוגמה: 1057" />
              </div>
              <div>
                <Label>פורמט</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "PDF" | "HTML" | "NEW" })}>
                  <option value="PDF">PDF — חתום דיגיטלית</option>
                  <option value="HTML">HTML — העתק מיידי</option>
                  <option value="NEW">NEW — חשבוניות שלא הודפסו</option>
                </select>
              </div>
              <Button type="submit" className="gap-2" disabled={loading}>
                <FileText className="size-4" /> {loading ? "מפיק..." : "הפק חשבונית"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {invoiceUrl ? (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">קישור חשבונית</div>
                <div dir="ltr" className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono break-all">{invoiceUrl}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(invoiceUrl); toast.success("הועתק"); }}>
                    <Copy className="size-4" /> העתק
                  </Button>
                  <Button size="sm" onClick={() => window.open(invoiceUrl, "_blank")}>
                    <ExternalLink className="size-4" /> פתח
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-6 text-sm text-muted-foreground space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 mt-0.5 text-primary shrink-0" />
                  <p>הזן מספר עסקה או מספר חשבונית. הקישור יופיע כאן.</p>
                </div>
                <ul className="text-xs space-y-1.5 ms-6 list-disc">
                  <li><b>PDF</b> — חתום דיגיטלית, זמין ~20 דקות אחרי העסקה.</li>
                  <li><b>HTML</b> — העתק מיידי לתצוגה.</li>
                  <li><b>NEW</b> — כל החשבוניות שעדיין לא הודפסו.</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
