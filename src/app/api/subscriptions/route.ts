import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, dbOne } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

interface SubRow {
  id: string; client_id: string; amount: number; coin: number;
  info: string; freq_months: number; next_charge: string; active: boolean;
  created_at: string;
  client_name: string; client_email: string; client_has_token: boolean;
}

export async function GET() {
  try {
    await requireUser();
    const rows = await db<SubRow>`
      SELECT s.id, s.client_id, s.amount, s.coin, s.info, s.freq_months,
             CONVERT(NVARCHAR(10), s.next_charge, 23) AS next_charge,
             s.active, CONVERT(NVARCHAR(20), s.created_at, 120) AS created_at,
             COALESCE(NULLIF(LTRIM(RTRIM(c.business_name)), ''),
               LTRIM(RTRIM(c.first_name + N' ' + c.last_name))) AS client_name,
             c.email AS client_email,
             CAST(CASE WHEN c.token IS NOT NULL AND c.token <> '' THEN 1 ELSE 0 END AS BIT) AS client_has_token
      FROM dbo.subscriptions s
      JOIN dbo.clients c ON c.id = s.client_id
      ORDER BY s.active DESC, s.next_charge ASC`;
    return NextResponse.json(rows);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { clientId, amount, coin, info, freqMonths, nextCharge } = body;

    if (!clientId || !amount || !info || !nextCharge) {
      return NextResponse.json({ error: "clientId, amount, info, nextCharge נדרשים" }, { status: 400 });
    }

    const client = await dbOne<{ token: string | null }>`
      SELECT token FROM dbo.clients WHERE id = ${clientId}`;
    if (!client) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    if (!client.token) {
      return NextResponse.json({ error: "ללקוח אין טוקן שמור — שלח ללקוח קישור תשלום תחילה" }, { status: 400 });
    }

    const row = await dbOne<{ id: string }>`
      INSERT INTO dbo.subscriptions (client_id, owner_id, amount, coin, info, freq_months, next_charge)
      OUTPUT inserted.id
      VALUES (${clientId}, ${user.id}, ${amount}, ${coin || 1}, ${info}, ${freqMonths || 1}, ${nextCharge})`;

    await logAudit({
      user, action: "subscription.create", ip: getIp(req),
      entity: "subscription", entityId: row?.id || "",
      details: { clientId, amount, coin: coin || 1, freqMonths: freqMonths || 1, nextCharge },
    });

    return NextResponse.json({ ok: true, id: row?.id });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
