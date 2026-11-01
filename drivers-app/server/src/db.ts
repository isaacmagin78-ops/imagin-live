import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type Sql = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','partner','driver')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES partners(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  city TEXT NOT NULL,
  accent TEXT NOT NULL,
  sms TEXT NOT NULL DEFAULT '',
  sms_publish INTEGER NOT NULL DEFAULT 0,
  sms_message TEXT NOT NULL,
  max_passengers INTEGER NOT NULL DEFAULT 4,
  active INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('none','starter','monthly')),
  plan_started_on TEXT,
  source_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_services (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_trust (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  line TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id TEXT PRIMARY KEY,
  public_code TEXT NOT NULL UNIQUE,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rider_name TEXT NOT NULL,
  rider_mobile TEXT NOT NULL,
  pickup TEXT NOT NULL,
  dropoff TEXT NOT NULL,
  ride_date TEXT NOT NULL,
  ride_time TEXT NOT NULL,
  passengers INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('requested','quoted','confirmed','declined','cancelled')),
  quote_amount_cents INTEGER,
  quote_note TEXT,
  quoted_pickup_time TEXT,
  quoted_at TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_events (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES partners(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('setup','monthly')),
  amount_cents INTEGER NOT NULL,
  partner_cut_bps INTEGER NOT NULL,
  partner_cut_cents INTEGER NOT NULL,
  note TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  to_address TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  related_type TEXT NOT NULL,
  related_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_driver ON ride_requests(driver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_fees_driver ON fee_events(driver_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_notes_related ON notifications(related_id, created_at);
`;

export function openDb(path: string): Sql {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    db.exec("PRAGMA journal_mode = WAL");
  } catch {
    /* :memory: may ignore WAL */
  }
  db.exec("PRAGMA busy_timeout = 3000");
  db.exec(SCHEMA);
  return db;
}

export function one<T>(db: Sql, sql: string, ...params: SQLInputValue[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row as T | undefined;
}

export function many<T>(db: Sql, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(db: Sql, sql: string, ...params: SQLInputValue[]): number {
  return Number(db.prepare(sql).run(...params).changes);
}

export function tx(db: Sql, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw err;
  }
}
