import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { dbOne } from "@/lib/db";
import { issueSession, setSessionCookie } from "@/lib/auth";
import { logAudit, getIp } from "@/lib/audit";
import { getOtpStore } from "../send/route";

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { email, code } = await req.json();
  if (!email || !code) return NextResponse.json({ error: "אימייל וקוד נדרשים" }, { status: 400 });

  const key = String(email).toLowerCase();
  const store = getOtpStore();
  const entry = store.get(key);

  const fail = (msg: string) => NextResponse.json({ error: msg }, { status: 401 });

  if (!entry) return fail("לא נשלח קוד לכתובת זו");
  if (Date.now() > entry.expires) { store.delete(key); return fail("הקוד פג תוקף — שלח קוד חדש"); }
  if (entry.attempts >= 5) { store.delete(key); return fail("יותר מדי ניסיונות — שלח קוד חדש"); }

  const inputHash = createHash("sha256").update(String(code)).digest("hex");
  if (inputHash !== entry.codeHash) {
    entry.attempts++;
    return fail(`קוד שגוי (${5 - entry.attempts} ניסיונות נותרו)`);
  }

  store.delete(key);

  const user = await dbOne<{ id: string; email: string }>`
    SELECT id, email FROM dbo.admin_users WHERE email = ${key}`;
  if (!user) return fail("משתמש לא נמצא");

  await logAudit({ user, action: "auth.login", ip, details: { success: true, method: "otp" } });

  const token = await issueSession(user);
  await setSessionCookie(token);
  return NextResponse.json({ user });
}
