import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db, dbOne } from "./db";

const COOKIE_NAME = "lintos_session";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours (ISO 27001 A.9.4)

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET || "";
  if (raw.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(raw);
}

export interface SessionUser {
  id: string;
  email: string;
}

interface JwtPayload extends SessionUser {
  iat?: number;
  exp?: number;
}

export async function issueSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as JwtPayload;
    if (!p.id || !p.email) return null;
    return { id: p.id, email: p.email };
  } catch { return null; }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws a 401 Response if no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const row = await dbOne<{ id: string; email: string; password_hash: string }>`
    SELECT id, email, password_hash FROM dbo.admin_users WHERE email = ${email.toLowerCase()}`;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email };
}

export async function createAdminUser(email: string, password: string): Promise<string> {
  const hash = await bcrypt.hash(password, 12);
  const row = await dbOne<{ id: string }>`
    INSERT INTO dbo.admin_users (email, password_hash)
    OUTPUT inserted.id
    VALUES (${email.toLowerCase()}, ${hash})`;
  return row!.id;
}

// Re-export the cookie name for the middleware (Edge runtime).
export const SESSION_COOKIE_NAME = COOKIE_NAME;
export { getSecret as _getAuthSecret };
