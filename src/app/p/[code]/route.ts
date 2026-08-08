import { NextRequest, NextResponse } from "next/server";
import { dbOne } from "@/lib/db";

// IIS ARR rewrites Location headers in 3xx responses. Using a client-side JS
// redirect avoids the Location header entirely so ARR can't interfere.
function htmlRedirect(url: string): NextResponse {
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const js = JSON.stringify(url);
  return new NextResponse(
    `<!doctype html><html><head><script>location.replace(${js})</script><meta http-equiv="refresh" content="0;url=${safe}"></head><body></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// Short URL /p/{code} redirects to our self-hosted Hosted Fields payment page
// at /pay/{code}. The tx must exist and still be pending — otherwise we send
// them to /payment/fail.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  let code = "unknown";
  try {
    code = (await params).code;
    const row = await dbOne<{ status: string }>`
      SELECT status FROM dbo.transactions WHERE short_code = ${code}`;
    if (!row) {
      return NextResponse.redirect(new URL("/payment/fail", req.url));
    }
    // Any browser hitting /p/<code> for a valid tx goes to the hosted-fields
    // page. Relative URL so the browser resolves against the public host
    // (Node sees localhost:3001 behind IIS ARR, not paym.lintos-tech.com).
    return htmlRedirect(`/pay/${encodeURIComponent(code)}`);
  } catch (e) {
    console.error(`[/p/${code}] error:`, String(e));
    return NextResponse.redirect(new URL("/payment/fail", req.url));
  }
}
