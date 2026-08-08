#!/usr/bin/env node
// Seed an admin user. Run on the server (or anywhere with .env.local + DB access):
//   node scripts/create-admin.mjs <email> <password>
//
// Reads DB connection from .env.local in the parent dir of this script.
// Requires the app's dependencies (mssql, bcryptjs) to be installed.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import sql from "mssql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");

try {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
} catch (e) {
  console.error(`Could not read ${envPath}: ${e.message}`);
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}

const config = {
  server: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  database: process.env.DB_NAME || "PaymentsDB",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false",
  },
};

const pool = await sql.connect(config);
const hash = await bcrypt.hash(password, 12);

try {
  const existing = await pool.request().input("email", email.toLowerCase())
    .query("SELECT id FROM dbo.admin_users WHERE email = @email");
  if (existing.recordset.length) {
    await pool.request()
      .input("email", email.toLowerCase()).input("hash", hash)
      .query("UPDATE dbo.admin_users SET password_hash = @hash WHERE email = @email");
    console.log(`Updated password for ${email}`);
  } else {
    const r = await pool.request()
      .input("email", email.toLowerCase()).input("hash", hash)
      .query("INSERT INTO dbo.admin_users (email, password_hash) OUTPUT inserted.id VALUES (@email, @hash)");
    console.log(`Created admin user ${email} (id=${r.recordset[0].id})`);
  }
} finally {
  await pool.close();
}
