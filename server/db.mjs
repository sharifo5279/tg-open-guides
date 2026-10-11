import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

let pool = null;

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  // Render's internal connection string does not need TLS config; external does.
  const needsSsl = /[?&]sslmode=require/.test(connectionString) ||
    (process.env.PGSSL === 'require');
  pool = new pg.Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error', err.message);
  });
  return pool;
}

export async function query(sql, params = []) {
  const res = await getPool().query(sql, params);
  return res;
}

export async function one(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] ?? null;
}

export async function many(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

export async function migrate() {
  const sql = await readFile(path.join(here, 'schema.sql'), 'utf8');
  await query(sql);
  return true;
}

export async function dbReady() {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
