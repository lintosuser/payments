import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (user) await logAudit({ user, action: "auth.logout", ip: getIp(req) });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
