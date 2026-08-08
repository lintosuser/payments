import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/payment/success", "/payment/fail", "/p", "/pay"];
const PUBLIC_API_PREFIXES = ["/api/payments/notify", "/api/payments/verify", "/api/payments/return", "/api/payments/handshake", "/api/payments/hf-complete", "/api/payments/diag-log", "/api/auth/login", "/api/auth/otp/", "/api/cron/charge"];
const COOKIE_NAME = "lintos_session";

async function verifyToken(token: string): Promise<boolean> {
  const raw = process.env.AUTH_SECRET || "";
  if (raw.length < 32) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(raw));
    return true;
  } catch { return false; }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = token ? await verifyToken(token) : false;

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (authed && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
