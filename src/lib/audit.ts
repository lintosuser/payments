import { dbExec } from "./db";
import type { SessionUser } from "./auth";

export type AuditAction =
  | "auth.login" | "auth.logout"
  | "client.create" | "client.update" | "client.delete"
  | "payment.create_link" | "payment.charge" | "payment.refund" | "payment.cancel" | "payment.commit"
  | "transaction.update" | "transaction.delete"
  | "subscription.create" | "subscription.update" | "subscription.toggle" | "subscription.delete"
  | "invoice.create" | "invoice.resend" | "invoice.bookkeeping_send"
  | "cron.charge_run";

/**
 * Write one audit record. Fire-and-forget — never throws so callers aren't affected.
 */
export async function logAudit(opts: {
  user: SessionUser | { id?: string; email: string };
  action: AuditAction;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await dbExec`
      INSERT INTO dbo.audit_log (user_id, user_email, action, entity, entity_id, details, ip)
      VALUES (
        ${opts.user.id || null},
        ${opts.user.email},
        ${opts.action},
        ${opts.entity || ""},
        ${opts.entityId || ""},
        ${opts.details ? JSON.stringify(opts.details) : ""},
        ${opts.ip || ""}
      )`;
  } catch (e) {
    console.error("[audit] failed to write log:", e);
  }
}

export function getIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
