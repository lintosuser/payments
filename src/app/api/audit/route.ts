import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface AuditRow {
  id: string;
  user_email: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  ip: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const action = searchParams.get("action") || "";

    const rows = await db<AuditRow>`
      SELECT TOP ${limit} id, user_email, action, entity, entity_id, details, ip,
             CONVERT(NVARCHAR(20), created_at, 120) AS created_at
      FROM dbo.audit_log
      WHERE (${action} = '' OR action = ${action})
      ORDER BY created_at DESC
      OFFSET ${offset} ROWS`;

    return NextResponse.json(rows);
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
