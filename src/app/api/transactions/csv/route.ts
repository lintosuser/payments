import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv, csvResponse } from "@/lib/csv";
import { clientDisplayName } from "@/lib/client-name";

const COIN: Record<number, string> = { 1: "ILS", 2: "USD", 3: "EUR", 4: "GBP" };

interface Row {
  yaad_id: string; created_at: Date; type: string; status: string;
  amount: number; coin: number; info: string;
  l4digit: string; brand: string; bank: string; acode: string; ccode: string; hesh: string;
  client_business_name: string | null;
  client_first_name: string | null; client_last_name: string | null; client_email: string | null;
}

export async function GET() {
  try {
    await requireUser();
    const rows = await db<Row>`
      SELECT t.yaad_id, t.created_at, t.type, t.status, t.amount, t.coin, t.info,
             t.l4digit, t.brand, t.bank, t.acode, t.ccode, t.hesh,
             c.business_name AS client_business_name,
             c.first_name AS client_first_name, c.last_name AS client_last_name, c.email AS client_email
      FROM dbo.transactions t LEFT JOIN dbo.clients c ON c.id = t.client_id
      ORDER BY t.created_at DESC`;
    const out = rows.map((t) => ({
      yaad_id: t.yaad_id,
      date: t.created_at,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: COIN[t.coin] ?? "ILS",
      info: t.info,
      client_name: clientDisplayName({
        business_name: t.client_business_name,
        first_name: t.client_first_name,
        last_name: t.client_last_name,
      }),
      client_email: t.client_email ?? "",
      l4digit: t.l4digit, brand: t.brand, bank: t.bank,
      acode: t.acode, ccode: t.ccode, hesh: t.hesh,
    }));
    const csv = toCsv(out as unknown as Record<string, unknown>[], [
      "yaad_id", "date", "type", "status", "amount", "currency", "info",
      "client_name", "client_email", "l4digit", "brand", "bank", "acode", "ccode", "hesh",
    ]);
    return csvResponse(csv, `transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
