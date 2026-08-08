import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProviderStatus } from "@/lib/payment";

export async function GET() {
  try {
    await requireUser();
    const payments = getProviderStatus();
    return NextResponse.json({
      db: {
        provider: "SQL Server",
        configured: Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD),
      },
      payments: {
        active: payments.active,
        configured: payments.configured,
        publicId: payments.publicId,
        available: payments.available,
      },
    });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
