import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { buildExpdate } from "@/lib/tranzila";
import { requireUser } from "@/lib/auth";
import { dbExec, dbOne } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { transId } = await req.json();
    const provider = getProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json({ error: `ספק התשלום (${provider.name}) לא מוגדר` }, { status: 500 });
    }

    const tx = await dbOne<{
      amount: number; acode: string;
      token: string | null; token_exp_month: string | null; token_exp_year: string | null;
    }>`
      SELECT t.amount, t.acode, c.token, c.token_exp_month, c.token_exp_year
      FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
      WHERE t.yaad_id = ${transId}`;

    if (!tx?.token) {
      return NextResponse.json({ error: "לא נמצא טוקן לעסקה זו" }, { status: 400 });
    }

    const expdate = buildExpdate(tx.token_exp_month || "", tx.token_exp_year || "");
    const result = await provider.cancel({
      providerTxId: transId,
      authNumber: tx.acode || "",
      token: tx.token,
      expdate,
      amount: Number(tx.amount) || 0,
    });

    if (result.success) {
      await dbExec`UPDATE dbo.transactions SET status = 'cancelled', ccode = ${result.responseCode} WHERE yaad_id = ${transId}`;
    }

    await logAudit({
      user, action: "payment.cancel", ip: getIp(req),
      entity: "transaction", entityId: transId,
      details: { success: result.success, code: result.responseCode },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "העסקה בוטלה" : provider.errorMessage(result.responseCode),
      result: result.raw,
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
