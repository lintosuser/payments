import { NextRequest, NextResponse } from "next/server";
import { issueSession, setSessionCookie, signIn } from "@/lib/auth";
import { logAudit, getIp } from "@/lib/audit";

// Simple in-process rate limiter: max 5 attempts per IP per minute.
const _attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    _attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "יותר מדי ניסיונות — נסה שוב בעוד דקה" }, { status: 429 });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "אימייל וסיסמה נדרשים" }, { status: 400 });
  }
  const user = await signIn(String(email), String(password));
  if (!user) {
    await logAudit({ user: { email: String(email) }, action: "auth.login", details: { success: false }, ip });
    return NextResponse.json({ error: "פרטי התחברות שגויים" }, { status: 401 });
  }
  await logAudit({ user, action: "auth.login", details: { success: true }, ip });
  const token = await issueSession(user);
  await setSessionCookie(token);
  return NextResponse.json({ user });
}
