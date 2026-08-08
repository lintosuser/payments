import { NextRequest, NextResponse } from "next/server";

/**
 * Diagnostic sink for the /pay page — captures whatever Tranzila's Hosted
 * Fields SDK hands back when a charge errors, so we can see the raw payload
 * without asking the customer to open dev tools. Public route.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.log("[pay-diag]", body.slice(0, 2000));
  } catch (e) {
    console.error("[pay-diag] read error:", e);
  }
  return NextResponse.json({ ok: true });
}
