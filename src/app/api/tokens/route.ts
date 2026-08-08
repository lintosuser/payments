import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbExec } from "@/lib/db";

// Manually save a Tranzila/YaadPay token on a client record.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { clientId, token, expdate } = await req.json();
    if (!clientId || !token || !expdate || expdate.length !== 4) {
      return NextResponse.json({ error: "clientId, token ו-expdate (MMYY) נדרשים" }, { status: 400 });
    }
    await dbExec`
      UPDATE dbo.clients
      SET token = ${token},
          token_exp_month = ${expdate.slice(0, 2)},
          token_exp_year = ${expdate.slice(2)}
      WHERE id = ${clientId}`;
    return NextResponse.json({ success: true, message: "טוקן נשמר בהצלחה" });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
