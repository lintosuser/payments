import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProviderStatus } from "@/lib/payment";
import { getBookkeepingSettings, setBookkeepingSettings, getVatPercent, setVatPercent } from "@/lib/app-settings";

export async function GET() {
  try {
    await requireUser();
    const payments = getProviderStatus();
    const bookkeeping = await getBookkeepingSettings();
    const vatPercent = await getVatPercent();
    return NextResponse.json({
      vatPercent,
      db: {
        provider: "SQL Server",
        configured: Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD),
      },
      payments: {
        active: payments.active,
        configured: payments.configured,
        publicId: payments.publicId,
        available: payments.available,
      },
      bookkeeping,
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function PUT(req: NextRequest) {
  try {
    await requireUser();
    const b = await req.json();
    const email = typeof b.email === "string" ? b.email.trim() : undefined;
    const cc = typeof b.cc === "string" ? b.cc.trim() : undefined;
    const businessName = typeof b.businessName === "string" ? b.businessName.trim() : undefined;
    const businessHp = typeof b.businessHp === "string" ? b.businessHp.trim() : undefined;

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email !== undefined && email && !emailRe.test(email)) {
      return NextResponse.json({ error: "אימייל הנה״ח לא תקין" }, { status: 400 });
    }
    if (cc !== undefined && cc && !emailRe.test(cc)) {
      return NextResponse.json({ error: "אימייל CC לא תקין" }, { status: 400 });
    }

    if (b.vatPercent !== undefined) {
      const n = parseFloat(b.vatPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: "אחוז מע״מ לא תקין (0-100)" }, { status: 400 });
      }
      await setVatPercent(n);
    }

    await setBookkeepingSettings({ email, cc, businessName, businessHp });
    return NextResponse.json({
      ok: true,
      bookkeeping: await getBookkeepingSettings(),
      vatPercent: await getVatPercent(),
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
