import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, dbExec, dbOne } from "@/lib/db";

interface TxRow {
  id: string;
  yaad_id: string;
  amount: number;
  coin: number;
  status: string;
  ccode: string;
  acode: string;
  info: string;
  hesh: string;
  type: string;
  l4digit: string;
  brand: string;
  bank: string;
  payment_url: string;
  client_id: string | null;
  owner_id: string | null;
  created_at: Date;
  client_business_name: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
}

interface TxApi extends Omit<TxRow, "client_business_name" | "client_first_name" | "client_last_name" | "client_email"> {
  client: { business_name: string; first_name: string; last_name: string; email: string } | null;
}

function flatten(row: TxRow): TxApi {
  const { client_business_name, client_first_name, client_last_name, client_email, ...rest } = row;
  const hasClient = client_email || client_business_name || (client_first_name && client_last_name);
  return {
    ...rest,
    client: hasClient
      ? {
          business_name: client_business_name ?? "",
          first_name: client_first_name ?? "",
          last_name: client_last_name ?? "",
          email: client_email ?? "",
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(sp.get("limit") || "200", 10), 1000);
    const status = sp.get("status");

    const rows = status
      ? await db<TxRow>`
          SELECT TOP (${limit}) t.*, c.business_name AS client_business_name, c.first_name AS client_first_name, c.last_name AS client_last_name, c.email AS client_email
          FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
          WHERE t.status = ${status}
          ORDER BY t.created_at DESC`
      : await db<TxRow>`
          SELECT TOP (${limit}) t.*, c.business_name AS client_business_name, c.first_name AS client_first_name, c.last_name AS client_last_name, c.email AS client_email
          FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
          ORDER BY t.created_at DESC`;

    return NextResponse.json(rows.map(flatten));
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const n = await dbExec`DELETE FROM dbo.transactions WHERE id = ${id}`;
    if (!n) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function PUT(req: NextRequest) {
  try {
    await requireUser();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const allowed = new Set(["info", "amount", "status", "type", "hesh"]);
    const cols: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(b)) {
      if (k === "id") continue;
      if (!allowed.has(k)) continue;
      cols.push(k);
      values.push(v);
    }
    if (!cols.length) return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });

    const { getPool } = await import("@/lib/db");
    const pool = await getPool();
    const r = pool.request();
    cols.forEach((_, i) => r.input(`p${i}`, values[i] as never));
    r.input("id", b.id);
    const result = await r.query(
      `UPDATE dbo.transactions SET ${cols.map((c, i) => `${c} = @p${i}`).join(", ")} OUTPUT inserted.* WHERE id = @id`,
    );
    const row = (result.recordset?.[0] as TxRow | undefined) || null;
    if (!row) return NextResponse.json({ error: "עסקה לא נמצאה" }, { status: 404 });
    // Re-select with client join for consistent shape.
    const full = await dbOne<TxRow>`
      SELECT t.*, c.business_name AS client_business_name, c.first_name AS client_first_name, c.last_name AS client_last_name, c.email AS client_email
      FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
      WHERE t.id = ${row.id}`;
    return NextResponse.json(full ? flatten(full) : flatten(row));
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
