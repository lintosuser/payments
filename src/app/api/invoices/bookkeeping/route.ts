import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbOne } from "@/lib/db";
import { dispatchInvoiceToBookkeeping } from "@/lib/bookkeeping";
import { logAudit, getIp } from "@/lib/audit";

/**
 * POST /api/invoices/bookkeeping  { transId }  (transId = Tranzila index / yaad_id)
 * Manually (re)send an already-issued invoice PDF to the bookkeeping inbox.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { transId } = await req.json();
    if (!transId) return NextResponse.json({ error: "transId נדרש" }, { status: 400 });

    const tx = await dbOne<{
      id: string; hesh: string; invoice_url: string; amount: number; coin: number; info: string;
    }>`SELECT id, hesh, invoice_url, amount, coin, info FROM dbo.transactions WHERE yaad_id = ${transId}`;
    if (!tx) return NextResponse.json({ error: "עסקה לא נמצאה" }, { status: 404 });
    if (!tx.hesh || tx.hesh === "0" || !tx.invoice_url) {
      return NextResponse.json({ error: "אין חשבונית לעסקה זו" }, { status: 400 });
    }

    const r = await dispatchInvoiceToBookkeeping({
      txId: tx.id, invoiceUrl: tx.invoice_url, docNumber: tx.hesh,
      amount: Number(tx.amount), currency: tx.coin, description: tx.info || "תשלום",
    });
    if (!r.ok) return NextResponse.json({ error: r.error || "שליחה נכשלה" }, { status: 502 });

    await logAudit({
      user, action: "invoice.bookkeeping_send", ip: getIp(req),
      entity: "transaction", entityId: transId, details: { docNumber: tx.hesh },
    });
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
