import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payment";

/**
 * Called by success/fail redirect pages to read the transaction result
 * appended to the success_url_address query string by the provider.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const provider = getProvider();
  const data = provider.parseRedirect(qs);
  return NextResponse.json({ ok: data.success, result: data.raw });
}
