import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendPaymentLinkEmail, isEmailConfigured } from "@/lib/email";

function toWhatsAppChatId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `${digits}@c.us`;
  // Israeli local: 05x → 9725x
  return `972${digits.replace(/^0/, "")}@c.us`;
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { channel, paymentUrl, clientName, clientEmail, clientPhone, amount, currency, info } = await req.json();
    if (!paymentUrl) return NextResponse.json({ error: "paymentUrl required" }, { status: 400 });

    if (channel === "email") {
      if (!clientEmail) return NextResponse.json({ error: "אין אימייל ללקוח" }, { status: 400 });
      if (!isEmailConfigured()) return NextResponse.json({ error: "SMTP לא מוגדר" }, { status: 501 });
      await sendPaymentLinkEmail({ to: clientEmail, clientName, paymentUrl, amount, currency, info });
      return NextResponse.json({ ok: true });
    }

    if (channel === "whatsapp") {
      const instanceId = process.env.GREENAPI_ID;
      const token = process.env.GREENAPI_TOKEN;
      if (!instanceId || !token) {
        return NextResponse.json({ error: "WhatsApp לא מוגדר — הוסף GREENAPI_ID ו-GREENAPI_TOKEN ל-.env.local" }, { status: 501 });
      }
      const phone = (clientPhone || "").replace(/\D/g, "");
      if (!phone) return NextResponse.json({ error: "מספר טלפון נדרש לשליחה ב-WhatsApp" }, { status: 400 });
      const chatId = toWhatsAppChatId(phone);
      const sym = currency === "ILS" ? "₪" : (currency || "");
      const amountStr = amount ? `${sym}${Number(amount).toLocaleString("he-IL")}` : "";
      const message = [
        `שלום${clientName ? ` ${clientName}` : ""},`,
        ``,
        `קיבלת קישור לתשלום${info ? ` עבור: ${info}` : ""}${amountStr ? ` - ${amountStr}` : ""}.`,
        ``,
        paymentUrl,
      ].join("\n");
      const res = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, message }) },
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        return NextResponse.json({ error: `Green API שגיאה: ${err.slice(0, 200)}` }, { status: 502 });
      }
      return NextResponse.json({ ok: true });
    }

    if (channel === "sms") {
      return NextResponse.json({ error: "SMS לא מוגדר עדיין" }, { status: 501 });
    }

    return NextResponse.json({ error: "channel not supported" }, { status: 400 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
