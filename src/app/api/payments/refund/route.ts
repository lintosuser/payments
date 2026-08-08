import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { buildExpdate } from "@/lib/tranzila";
import { requireUser } from "@/lib/auth";
import { dbExec, dbOne } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { transId, amount } = await req.json();
    const provider = getProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json({ error: `ספק התשלום (${provider.name}) לא מוגדר` }, { status: 500 });
    }

    const tx = await dbOne<{
      acode: string; coin: number;
      token: string | null; token_exp_month: string | null; token_exp_year: string | null;
    }>`
      SELECT t.acode, t.coin, c.token, c.token_exp_month, c.token_exp_year
      FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
      WHERE t.yaad_id = ${transId}`;

    if (!tx?.token) {
      return NextResponse.json({ error: "לא נמצא טוקן לעסקה זו — לא ניתן לבצע זיכוי" }, { status: 400 });
    }

    const expdate = buildExpdate(tx.token_exp_month || "", tx.token_exp_year || "");
    const result = await provider.refund({
      providerTxId: transId,
      authNumber: tx.acode || "",
      token: tx.token,
      expdate,
      amount,
      currency: (tx.coin || 1) as 1 | 2 | 3 | 4,
    });

    if (result.success) {
      await dbExec`
        INSERT INTO dbo.transactions (yaad_id, amount, coin, status, ccode, acode, info, type, owner_id)
        VALUES (${result.providerTxId}, ${amount}, ${tx.coin || 1}, 'refunded',
                ${result.responseCode}, ${result.confirmationCode},
                ${"זיכוי עבור עסקה " + transId}, 'refund', ${user.id})`;
    }

    await logAudit({
      user, action: "payment.refund", ip: getIp(req),
      entity: "transaction", entityId: transId,
      details: { amount, success: result.success, code: result.responseCode },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "הזיכוי בוצע בהצלחה" : provider.errorMessage(result.responseCode),
      result: result.raw,
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
