import { NextRequest, NextResponse } from "next/server";
import { dbOne } from "@/lib/db";

/**
 * Tranzila Hosted Fields v2 handshake — https://api.tranzila.com/v1/handshake/create
 *
 * Client-side Hosted Fields SDK requires a `thtk` handshake token before it
 * can submit card data to Tranzila. This endpoint takes our short_code,
 * looks up the pending transaction, calls Tranzila's handshake API, and
 * returns everything the payment page needs to render Hosted Fields.
 *
 * Public route (no session) — the short_code IS the auth: it's a 6-char
 * random string that only the customer holds.
 */

interface TxRow {
  id: string;
  amount: number;
  coin: number;
  info: string;
  status: string;
  hk_freq_months: number | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_business_name: string | null;
  client_email: string | null;
  client_phone: string | null;
}

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code") || "";
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const tx = await dbOne<TxRow & { type: string }>`
    SELECT t.id, t.amount, t.coin, t.info, t.status, t.hk_freq_months, t.type,
           c.first_name as client_first_name, c.last_name as client_last_name,
           c.business_name as client_business_name,
           c.email as client_email, c.cell as client_phone
    FROM dbo.transactions t
    LEFT JOIN dbo.clients c ON c.id = t.client_id
    WHERE t.short_code = ${code}`;
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "already processed", status: tx.status }, { status: 410 });
  }

  // Hosted Fields v2 uses the customer-facing `lintos` terminal (where HF is
  // enabled). The resulting token is shared with the paired `lintostok`
  // token-vault terminal, which is what the cron uses for recurring charges.
  const terminal = process.env.TRANZILA_TERMINAL || "";
  const password = process.env.TRANZILA_PASSWORD || "";
  if (!terminal || !password) {
    return NextResponse.json({ error: "TRANZILA_TERMINAL/PASSWORD not configured" }, { status: 500 });
  }

  const qs = new URLSearchParams({
    supplier: terminal,
    sum: tx.amount.toFixed(2),
    TranzilaPW: password,
  });
  const url = `https://api.tranzila.com/v1/handshake/create?${qs}`;

  let thtk: string | undefined;
  try {
    const res = await fetch(url);
    const body = await res.text();
    // Tranzila returns key=val pairs (thtk=XXXX&Response=000) OR JSON.
    const params = new URLSearchParams(body);
    thtk = params.get("thtk") || undefined;
    if (!thtk) {
      try {
        const j = JSON.parse(body);
        thtk = j.thtk || undefined;
      } catch { /* not json */ }
    }
    if (!thtk) {
      console.error("[handshake] no thtk in response:", res.status, body.slice(0, 300));
      return NextResponse.json({ error: "handshake failed", details: body.slice(0, 200) }, { status: 502 });
    }
  } catch (e) {
    console.error("[handshake] fetch error:", e);
    return NextResponse.json({ error: "handshake fetch failed" }, { status: 502 });
  }

  const contact = tx.client_business_name?.trim()
    || `${tx.client_first_name || ""} ${tx.client_last_name || ""}`.trim()
    || "";

  return NextResponse.json({
    thtk,
    terminalName: terminal,
    amount: tx.amount,
    coin: tx.coin,
    info: tx.info,
    contact,
    email: tx.client_email || "",
    phone: tx.client_phone || "",
    txId: tx.id,
    hk: Boolean(tx.hk_freq_months),
    mode: tx.type === "card_update" ? "update" : "charge",
  });
}
