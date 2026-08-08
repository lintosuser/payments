import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { buildExpdate } from "@/lib/tranzila";
import { requireUser } from "@/lib/auth";
import { dbExec, dbOne } from "@/lib/db";
import { clientDisplayName } from "@/lib/client-name";
import { logAudit, getIp } from "@/lib/audit";

interface ClientRow {
  id: string;
  business_name: string;
  first_name: string; last_name: string;
  email: string; phone: string; cell: string;
  token: string | null; token_exp_month: string | null; token_exp_year: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const provider = getProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json({ error: `ספק התשלום (${provider.name}) לא מוגדר` }, { status: 500 });
    }

    const amount = Number(body.amount);
    if (!amount || amount <= 0 || !isFinite(amount)) {
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    }
    const coin = Number(body.coin || 1);
    if (![1, 2, 3, 4].includes(coin)) {
      return NextResponse.json({ error: "מטבע לא תקין" }, { status: 400 });
    }

    let client: ClientRow | null = null;
    if (body.clientId) {
      client = await dbOne<ClientRow>`SELECT * FROM dbo.clients WHERE id = ${body.clientId}`;
    }
    if (body.clientId && client && !client.token) {
      return NextResponse.json({ error: "ללקוח אין טוקן שמור" }, { status: 400 });
    }

    const token = client?.token || body.token;
    const expdate = client
      ? buildExpdate(client.token_exp_month || "", client.token_exp_year || "")
      : (body.expdate || buildExpdate(body.tmonth || "", body.tyear || ""));

    const result = await provider.chargeToken({
      token,
      expdate,
      amount: body.amount,
      info: body.info,
      contact: client
        ? clientDisplayName(client)
        : (body.businessName?.trim() || `${body.clientName || ""} ${body.clientLName || ""}`.trim()),
      email: client?.email || body.email,
      phone: client?.phone || client?.cell || body.phone || body.cell,
      currency: body.coin || 1,
      tash: body.tash,
      postpone: body.postpone || body.j5,
    });

    const status = result.success ? "approved" : result.postponed ? "postponed" : "failed";

    await dbExec`
      INSERT INTO dbo.transactions (yaad_id, client_id, amount, coin, status, ccode, acode, info, hesh, type, l4digit, brand, bank, owner_id)
      VALUES (${result.providerTxId}, ${body.clientId || null}, ${body.amount}, ${body.coin || 1},
              ${status}, ${result.responseCode}, ${result.confirmationCode}, ${body.info}, '',
              ${status === "postponed" ? "payment" : "charge"},
              ${result.last4}, ${result.brand}, '', ${user.id})`;

    if (result.success && result.token && body.clientId) {
      await dbExec`
        UPDATE dbo.clients
        SET token = ${result.token},
            token_exp_month = ${result.tokenExpMonth || null},
            token_exp_year = ${result.tokenExpYear || null},
            l4digit = ${result.last4 || null}
        WHERE id = ${body.clientId}`;
    }

    await logAudit({
      user, action: "payment.charge", ip: getIp(req),
      entity: "transaction", entityId: result.providerTxId || "",
      details: { clientId: body.clientId, amount, coin, status, code: result.responseCode },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "החיוב בוצע בהצלחה" : provider.errorMessage(result.responseCode),
      result: result.raw,
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
