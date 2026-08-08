import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbExec } from "@/lib/db";
import { logAudit, getIp } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { amount, coin, info, freqMonths, nextCharge } = await req.json();
    if (!amount || !info || !nextCharge) {
      return NextResponse.json({ error: "amount, info, nextCharge נדרשים" }, { status: 400 });
    }
    await dbExec`
      UPDATE dbo.subscriptions
      SET amount = ${amount}, coin = ${coin || 1}, info = ${info},
          freq_months = ${freqMonths || 1}, next_charge = ${nextCharge}
      WHERE id = ${id}`;
    await logAudit({ user, action: "subscription.update", ip: getIp(req), entity: "subscription", entityId: id, details: { amount, coin, freqMonths, nextCharge } });
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { active } = await req.json();
    await dbExec`UPDATE dbo.subscriptions SET active = ${active ? 1 : 0} WHERE id = ${id}`;
    await logAudit({ user, action: "subscription.toggle", ip: getIp(req), entity: "subscription", entityId: id, details: { active } });
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await dbExec`DELETE FROM dbo.subscriptions WHERE id = ${id}`;
    await logAudit({ user, action: "subscription.delete", ip: getIp(req), entity: "subscription", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
