import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbOne } from "@/lib/db";
import { sendInvoiceEmail, isEmailConfigured } from "@/lib/email";
import { clientDisplayName } from "@/lib/client-name";
import { logAudit, getIp } from "@/lib/audit";

const COIN_SYMBOL: Record<number, string> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

/**
 * POST /api/invoices/resend
 * Body: { transId: string }  — yaad_id of the transaction
 * Re-emails the stored invoice PDF link to the client.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    if (!body.transId) return NextResponse.json({ error: "transId נדרש" }, { status: 400 });

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "SMTP לא מוגדר" }, { status: 501 });
    }

    const tx = await dbOne<{
      id: string; hesh: string; invoice_url: string; amount: number; coin: number; info: string;
      client_email: string | null; client_business_name: string | null;
      client_first_name: string | null; client_last_name: string | null;
    }>`
      SELECT t.id, t.hesh, t.invoice_url, t.amount, t.coin, t.info,
             c.email AS client_email, c.business_name AS client_business_name,
             c.first_name AS client_first_name, c.last_name AS client_last_name
      FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
      WHERE t.yaad_id = ${body.transId}`;

    if (!tx) return NextResponse.json({ error: "עסקה לא נמצאה" }, { status: 404 });
    if (!tx.hesh || tx.hesh === "0") return NextResponse.json({ error: "אין חשבונית לעסקה זו" }, { status: 400 });
    if (!tx.invoice_url) return NextResponse.json({ error: "אין קישור לחשבונית (חשבונית ישנה)" }, { status: 400 });
    if (!tx.client_email) return NextResponse.json({ error: "אין אימייל ללקוח" }, { status: 400 });

    await sendInvoiceEmail({
      to: tx.client_email,
      clientName: clientDisplayName({
        business_name: tx.client_business_name,
        first_name: tx.client_first_name,
        last_name: tx.client_last_name,
      }),
      docNumber: tx.hesh,
      invoiceUrl: tx.invoice_url,
      amount: tx.amount,
      currency: COIN_SYMBOL[tx.coin] || "ILS",
      description: tx.info || "תשלום",
      coin: tx.coin,
    });

    await logAudit({
      user, action: "invoice.resend", ip: getIp(req),
      entity: "transaction", entityId: body.transId,
      details: { docNumber: tx.hesh, to: tx.client_email },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[invoices/resend]", e);
    return NextResponse.json({ error: "שגיאה בשליחת מייל" }, { status: 500 });
  }
}
