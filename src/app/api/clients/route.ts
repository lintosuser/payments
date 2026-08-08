import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, dbExec, dbOne } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

interface ClientRow {
  id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  user_id: string;
  email: string;
  phone: string;
  cell: string;
  street: string;
  city: string;
  zip: string;
  token: string | null;
  token_exp_month: string | null;
  token_exp_year: string | null;
  l4digit: string | null;
  notes: string;
  owner_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function nameError(b: { businessName?: string; firstName?: string; lastName?: string }): string | null {
  const biz = (b.businessName ?? "").trim();
  const fn  = (b.firstName ?? "").trim();
  const ln  = (b.lastName ?? "").trim();
  if (biz) return null;
  if (fn && ln) return null;
  return "יש להזין שם עסק או שם פרטי + שם משפחה";
}

export async function GET() {
  try {
    await requireUser();
    const rows = await db<ClientRow>`SELECT * FROM dbo.clients ORDER BY created_at DESC`;
    return NextResponse.json(rows);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const b = await req.json();

    const err = nameError(b);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    if (!b.email || !b.cell) {
      return NextResponse.json({ error: "אימייל ונייד נדרשים" }, { status: 400 });
    }

    const row = await dbOne<ClientRow>`
      INSERT INTO dbo.clients (business_name, first_name, last_name, user_id, email, phone, cell, street, city, zip, owner_id)
      OUTPUT inserted.*
      VALUES (${(b.businessName ?? "").trim()},
              ${(b.firstName ?? "").trim()},
              ${(b.lastName ?? "").trim()},
              ${b.userId}, ${b.email},
              ${b.phone ?? ""}, ${b.cell},
              ${b.street ?? ""}, ${b.city ?? ""}, ${b.zip ?? ""},
              ${user.id})`;
    await logAudit({ user, action: "client.create", ip: getIp(req), entity: "client", entityId: row?.id || "" });
    return NextResponse.json(row, { status: 201 });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // For PUT we only validate names if at least one of them was sent.
    if ("businessName" in b || "firstName" in b || "lastName" in b) {
      const err = nameError(b);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const map: Record<string, string> = {
      businessName: "business_name", business_name: "business_name",
      firstName: "first_name", first_name: "first_name",
      lastName: "last_name", last_name: "last_name",
      userId: "user_id", user_id: "user_id",
      email: "email", phone: "phone", cell: "cell",
      street: "street", city: "city", zip: "zip",
      token: "token",
      tokenExpMonth: "token_exp_month", token_exp_month: "token_exp_month",
      tokenExpYear: "token_exp_year", token_exp_year: "token_exp_year",
      l4digit: "l4digit",
      notes: "notes",
    };

    const cols: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(b)) {
      if (k === "id") continue;
      const col = map[k];
      if (!col) continue;
      cols.push(col);
      values.push(v);
    }
    if (!cols.length) return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });

    const { getPool } = await import("@/lib/db");
    const pool = await getPool();
    const req2 = pool.request();
    cols.forEach((_, i) => req2.input(`p${i}`, values[i] as never));
    req2.input("id", b.id);
    const result = await req2.query(
      `UPDATE dbo.clients SET ${cols.map((c, i) => `${c} = @p${i}`).join(", ")} OUTPUT inserted.* WHERE id = @id`,
    );
    const row = (result.recordset?.[0] as ClientRow | undefined) || null;
    if (!row) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    await logAudit({ user, action: "client.update", ip: getIp(req), entity: "client", entityId: b.id });
    return NextResponse.json(row);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const n = await dbExec`DELETE FROM dbo.clients WHERE id = ${id}`;
    if (!n) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    await logAudit({ user, action: "client.delete", ip: getIp(req), entity: "client", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
