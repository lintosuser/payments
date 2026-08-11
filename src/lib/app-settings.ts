import { db, dbExec } from "@/lib/db";

/**
 * Bookkeeping / business identity used when forwarding invoices to the
 * accountant inbox. Values are stored in dbo.app_settings (UI-editable) and
 * fall back to env vars, then hard defaults.
 */
export interface BookkeepingSettings {
  businessName: string;
  businessHp: string;
  email: string;   // recipient (paperless.tax inbox)
  cc: string;      // CC (owner)
}

const KEYS = {
  businessName: "bk_business_name",
  businessHp: "bk_business_hp",
  email: "bk_email",
  cc: "bk_cc",
} as const;

const DEFAULTS: BookkeepingSettings = {
  businessName: process.env.BUSINESS_NAME || "Lintos Technology Solutions",
  businessHp: process.env.BUSINESS_HP || "35714948",
  email: process.env.BOOKKEEPING_EMAIL || "bk@mail.paperless.tax",
  cc: process.env.BOOKKEEPING_CC || "tomer.deri78@gmail.com",
};

export async function getBookkeepingSettings(): Promise<BookkeepingSettings> {
  try {
    const rows = await db<{ skey: string; sval: string }>`
      SELECT skey, sval FROM dbo.app_settings WHERE skey IN (
        ${KEYS.businessName}, ${KEYS.businessHp}, ${KEYS.email}, ${KEYS.cc}
      )`;
    const map = new Map(rows.map((r) => [r.skey, r.sval]));
    const pick = (k: string, d: string) => {
      const v = map.get(k);
      return v && v.trim() ? v.trim() : d;
    };
    return {
      businessName: pick(KEYS.businessName, DEFAULTS.businessName),
      businessHp: pick(KEYS.businessHp, DEFAULTS.businessHp),
      email: pick(KEYS.email, DEFAULTS.email),
      cc: pick(KEYS.cc, DEFAULTS.cc),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setBookkeepingSettings(s: Partial<BookkeepingSettings>): Promise<void> {
  const pairs: [string, string | undefined][] = [
    [KEYS.businessName, s.businessName],
    [KEYS.businessHp, s.businessHp],
    [KEYS.email, s.email],
    [KEYS.cc, s.cc],
  ];
  for (const [key, val] of pairs) {
    if (val === undefined) continue;
    await dbExec`
      MERGE dbo.app_settings AS t
      USING (SELECT ${key} AS skey, ${val} AS sval) AS src
      ON t.skey = src.skey
      WHEN MATCHED THEN UPDATE SET sval = src.sval, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (skey, sval) VALUES (src.skey, src.sval);`;
  }
}
