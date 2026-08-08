import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { dbOne } from "@/lib/db";
import { sendOtpEmail, isEmailConfigured } from "@/lib/email";
import { getIp } from "@/lib/audit";

// In-process store: email → { codeHash, expires, attempts }
const _store = new Map<string, { codeHash: string; expires: number; attempts: number }>();

export function getOtpStore() { return _store; }

const _rateLimit = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = _rateLimit.get(ip);
  if (!e || e.resetAt < now) { _rateLimit.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 5) return false;
  e.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRate(ip)) {
    return NextResponse.json({ error: "יותר מדי ניסיונות — נסה שוב בעוד דקה" }, { status: 429 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "אימייל נדרש" }, { status: 400 });

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "SMTP לא מוגדר" }, { status: 501 });
  }

  // Verify email exists in admin_users
  const row = await dbOne<{ id: string }>`SELECT id FROM dbo.admin_users WHERE email = ${String(email).toLowerCase()}`;
  // Always return ok to avoid email enumeration
  if (row) {
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash("sha256").update(code).digest("hex");
    _store.set(email.toLowerCase(), { codeHash, expires: Date.now() + 10 * 60_000, attempts: 0 });
    await sendOtpEmail({ to: email, code });
  }

  return NextResponse.json({ ok: true });
}
