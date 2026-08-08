import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, dbExec, dbOne } from "@/lib/db";
import { toCsv, fromCsv, csvResponse } from "@/lib/csv";

const COLS = [
  "business_name", "first_name", "last_name", "user_id", "email", "phone", "cell",
  "street", "city", "zip", "token", "token_exp_month", "token_exp_year", "l4digit",
] as const;

export async function GET() {
  try {
    await requireUser();
    const rows = await db<Record<string, unknown>>`SELECT * FROM dbo.clients ORDER BY created_at DESC`;
    const out = rows.map((c) => {
      const o: Record<string, unknown> = {};
      for (const k of COLS) o[k] = c[k] ?? "";
      return o;
    });
    const csv = toCsv(out, COLS as unknown as string[]);
    return csvResponse(csv, `clients-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

const HEADER_MAP: Record<string, string> = {
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
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const text = await req.text();
    const rows = fromCsv<Record<string, string>>(text);
    let created = 0, updated = 0, skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        const mapped = HEADER_MAP[k];
        if (mapped) r[mapped] = v;
      }

      const hasBiz = (r.business_name ?? "").trim().length > 0;
      const hasPerson = (r.first_name ?? "").trim() && (r.last_name ?? "").trim();
      if (!hasBiz && !hasPerson) {
        errors.push({ row: i + 2, reason: "missing name (business_name or first_name+last_name required)" });
        skipped++; continue;
      }
      if (!r.user_id || !r.email || !r.cell) {
        errors.push({ row: i + 2, reason: "missing required field (user_id, email, cell)" });
        skipped++; continue;
      }

      try {
        const existing = await dbOne<{ id: string }>`SELECT id FROM dbo.clients WHERE user_id = ${r.user_id}`;
        if (existing) {
          await dbExec`
            UPDATE dbo.clients SET
              business_name = ${r.business_name ?? ""},
              first_name = ${r.first_name ?? ""}, last_name = ${r.last_name ?? ""},
              email = ${r.email}, phone = ${r.phone ?? ""}, cell = ${r.cell},
              street = ${r.street ?? ""}, city = ${r.city ?? ""}, zip = ${r.zip ?? ""},
              token = ${r.token || null},
              token_exp_month = ${r.token_exp_month || null},
              token_exp_year = ${r.token_exp_year || null},
              l4digit = ${r.l4digit || null}
            WHERE id = ${existing.id}`;
          updated++;
        } else {
          await dbExec`
            INSERT INTO dbo.clients (business_name, first_name, last_name, user_id, email, phone, cell, street, city, zip,
                                     token, token_exp_month, token_exp_year, l4digit, owner_id)
            VALUES (${r.business_name ?? ""}, ${r.first_name ?? ""}, ${r.last_name ?? ""},
                    ${r.user_id}, ${r.email}, ${r.phone ?? ""}, ${r.cell},
                    ${r.street ?? ""}, ${r.city ?? ""}, ${r.zip ?? ""},
                    ${r.token || null}, ${r.token_exp_month || null}, ${r.token_exp_year || null},
                    ${r.l4digit || null}, ${user.id})`;
          created++;
        }
      } catch (err) {
        errors.push({ row: i + 2, reason: err instanceof Error ? err.message : String(err) });
        skipped++;
      }
    }

    return NextResponse.json({ created, updated, skipped, total: rows.length, errors });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
