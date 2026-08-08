import sql, { type config as MssqlConfig, type ConnectionPool, type IResult } from "mssql";

let pool: ConnectionPool | null = null;
let connecting: Promise<ConnectionPool> | null = null;

function buildConfig(): MssqlConfig {
  const port = parseInt(process.env.DB_PORT || "1433", 10);
  return {
    server: process.env.DB_HOST || "localhost",
    port,
    database: process.env.DB_NAME || "PaymentsDB",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false",
      enableArithAbort: true,
    },
  };
}

export async function getPool(): Promise<ConnectionPool> {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting;
  connecting = sql.connect(buildConfig()).then((p) => { pool = p; connecting = null; return p; });
  return connecting;
}

type SqlValue = string | number | boolean | Date | Buffer | null | undefined;

/**
 * Tagged template for parameterised queries. Interpolated values become
 * @p0, @p1, ... — never string-concatenated into the SQL text.
 *
 *   const rows = await db<{ id: string }>`SELECT id FROM dbo.clients WHERE user_id = ${userId}`;
 */
export async function db<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
): Promise<T[]> {
  const p = await getPool();
  const req = p.request();
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    const name = `p${i}`;
    req.input(name, values[i] ?? null);
    text += `@${name}` + strings[i + 1];
  }
  const result: IResult<T> = await req.query(text);
  return result.recordset;
}

/** Tagged template that returns the first row (or null). */
export async function dbOne<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
): Promise<T | null> {
  const rows = await db<T>(strings, ...values);
  return rows[0] ?? null;
}

/** Tagged template for INSERT/UPDATE/DELETE — returns rowsAffected. */
export async function dbExec(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
): Promise<number> {
  const p = await getPool();
  const req = p.request();
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    const name = `p${i}`;
    req.input(name, values[i] ?? null);
    text += `@${name}` + strings[i + 1];
  }
  const result = await req.query(text);
  return result.rowsAffected.reduce((a, b) => a + b, 0);
}
