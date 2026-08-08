import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { requireUser } from "@/lib/auth";
import { dbExec, dbOne } from "@/lib/db";
import { clientDisplayName } from "@/lib/client-name";
import { logAudit, getIp } from "@/lib/audit";
import { sendPaymentLinkEmail, isEmailConfigured } from "@/lib/email";

const SHORT_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genShortCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += SHORT_CHARS[Math.floor(Math.random() * SHORT_CHARS.length)];
  return s;
}

interface ClientRow {
  id: string;
  business_name: string;
  first_name: string; last_name: string;
  user_id: string;
  email: string; phone: string; cell: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const provider = getProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json({ error: `ספק התשלום (${provider.name}) לא מוגדר` }, { status: 500 });
    }

    let client: ClientRow | null = null;
    if (body.clientId) {
      client = await dbOne<ClientRow>`SELECT id, business_name, first_name, last_name, user_id, email, phone, cell FROM dbo.clients WHERE id = ${body.clientId}`;
    }

    // APP_URL (no NEXT_PUBLIC_ prefix) so it's read at runtime — not baked
    // into the build. The fallback to NEXT_PUBLIC_APP_URL keeps older
    // deployments working.
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    const hkFreq = body.hk ? (parseInt(body.freq) || null) : null;
    const hkDate = body.hk && body.firstDate ? body.firstDate : null;
    const shortCode = genShortCode();

    const inserted = await dbOne<{ id: string }>`
      INSERT INTO dbo.transactions (yaad_id, client_id, amount, coin, status, info, type, payment_url, owner_id, hk_freq_months, hk_next_charge, short_code)
      OUTPUT inserted.id
      VALUES ('', ${body.clientId || null}, ${body.amount}, ${body.coin || 1},
              'pending', ${body.info}, 'payment', '', ${user.id},
              ${hkFreq}, ${hkDate}, ${shortCode})`;
    const txId = inserted?.id || "";

    const { paymentUrl } = await provider.createPaymentLink({
      amount: body.amount,
      info: body.info,
      currency: body.coin || 1,
      tash: body.tash,
      email: client?.email || body.email,
      phone: client?.phone || client?.cell || body.phone || body.cell,
      contact: client
        ? clientDisplayName(client)
        : (body.businessName?.trim() || `${body.clientName || ""} ${body.clientLName || ""}`.trim()),
      myid: txId || undefined,
      customerId: client?.user_id || body.userId || undefined,
      // Save card token for future charges — only meaningful when we have a
      // client to attach the token to. Caller can disable explicitly.
      tokenize: body.tokenize ?? Boolean(body.clientId),
      successUrl: `${appUrl}/api/payments/return?target=success`,
      failUrl: `${appUrl}/api/payments/return?target=fail`,
      notifyUrl: `${appUrl}/api/payments/notify`,
    });

    if (txId) {
      await dbExec`UPDATE dbo.transactions SET payment_url = ${paymentUrl} WHERE id = ${txId}`;
    }

    await logAudit({
      user, action: "payment.create_link", ip: getIp(req),
      entity: "transaction", entityId: txId,
      details: { clientId: body.clientId, amount: body.amount, coin: body.coin || 1 },
    });

    const shortUrl = `${appUrl}/p/${shortCode}`;

    // Auto-send payment link email if requested and SMTP is configured
    let emailSent = false;
    const clientEmail = client?.email || body.email as string | undefined;
    if (body.sendemail && clientEmail && isEmailConfigured()) {
      try {
        const displayName = client
          ? clientDisplayName(client)
          : ((body.businessName as string) || `${body.clientName || ""} ${body.clientLName || ""}`.trim());
        await sendPaymentLinkEmail({
          to: clientEmail,
          clientName: displayName,
          paymentUrl: shortUrl,
          amount: body.amount as number | undefined,
          currency: body.coin === 1 ? "ILS" : body.coin === 2 ? "USD" : body.coin === 3 ? "EUR" : "GBP",
          info: body.info as string | undefined,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("[create-link] email send failed:", String(emailErr));
      }
    }

    return NextResponse.json({ paymentUrl, shortUrl, emailSent });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
