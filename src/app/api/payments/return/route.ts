import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";
import { dbExec, dbOne } from "@/lib/db";
import type { NotifyData } from "@/lib/payment/types";

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Tranzila redirects the customer back to success_url / fail_url via HTTP POST
 * (form-encoded body), not GET. Next.js client pages can't read POST bodies,
 * so this server handler accepts both POST and GET, parses params from
 * whichever, and 303-redirects to the UI page with everything in the URL
 * query string.
 *
 *   ?target=success  -> /payment/success?{params}
 *   ?target=fail     -> /payment/fail?{params}
 *
 * The provider's create-link sets these as success_url / fail_url.
 *
 * The card token's expiry and last-4 digits are only reliably present on
 * *this* customer-facing redirect — the server-to-server notify callback
 * echoes the reusable token but not the card's expiry, so recurring charges
 * built from notify-only data have nothing to build an expdate from. We
 * persist just those three fields here (token, expiry, last4 — never a full
 * card number, which the hosted iframe never exposes to us anyway).
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const target = url.searchParams.get("target") === "fail" ? "fail" : "success";

  const params: Record<string, string> = {};
  let notifyData: NotifyData | null = null;

  if (req.method === "POST") {
    const raw = await req.text();
    notifyData = getProvider().parseNotify(raw);
    Object.assign(params, notifyData.raw);
  } else {
    notifyData = getProvider().parseRedirect(url.searchParams.toString());
  }

  // GET (or POST with redundant query) — merge URL params, skipping our own `target`.
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "target") continue;
    if (!(k in params)) params[k] = v;
  }

  if (target === "success") {
    // Log per-field value LENGTHS only (never the values themselves) so we
    // can tell which fields are present-but-empty vs. actually populated.
    const lens: Record<string, number> = {};
    for (const [k, v] of Object.entries(notifyData.raw)) {
      lens[k] = typeof v === "string" ? v.length : 0;
    }
    console.log("[return] received", JSON.stringify({
      method: req.method, hasToken: Boolean(notifyData.token),
      hasExpMonth: Boolean(notifyData.tokenExpMonth), hasLast4: Boolean(notifyData.last4),
      lens,
    }));
  }

  if (target === "success" && notifyData.success && notifyData.token && GUID_RE.test(notifyData.myid)) {
    try {
      const tx = await dbOne<{ client_id: string | null }>`
        SELECT client_id FROM dbo.transactions WHERE id = ${notifyData.myid}`;
      if (tx?.client_id) {
        await dbExec`
          UPDATE dbo.clients
          SET token = ${notifyData.token},
              token_exp_month = ${notifyData.tokenExpMonth || null},
              token_exp_year = ${notifyData.tokenExpYear || null},
              l4digit = ${notifyData.last4 || null}
          WHERE id = ${tx.client_id}`;
      }
    } catch (e) {
      console.error("[return] token save failed:", e);
    }
  }

  const qs = new URLSearchParams(params).toString();
  const dest = new URL(`/payment/${target}${qs ? "?" + qs : ""}`, url);
  // 303 forces the browser to follow with GET regardless of original method.
  return NextResponse.redirect(dest, 303);
}

export const GET = handle;
export const POST = handle;
