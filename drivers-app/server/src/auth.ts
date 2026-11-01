import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sessionDays } from "./env.ts";
import { one, run, type Sql } from "./db.ts";
import type { SessionUser } from "../../shared/types.ts";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = (await scryptAsync(password, salt, 32)) as Buffer;
  const prev = Buffer.from(hash, "base64url");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  const pepper = process.env.SESSION_SECRET || "dev-only-session-pepper";
  return createHash("sha256").update(pepper).update(token).digest("base64url");
}

type SessionRow = {
  id: string;
  email: string;
  role: SessionUser["role"];
  display_name: string;
  partner_id: string | null;
  driver_id: string | null;
  driver_slug: string | null;
};

export function userFromToken(db: Sql, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = one<SessionRow>(
    db,
    `SELECT u.id, u.email, u.role, u.display_name,
            p.id AS partner_id, d.id AS driver_id, d.slug AS driver_slug
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN partners p ON p.user_id = u.id
     LEFT JOIN drivers d ON d.user_id = u.id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    hashToken(token),
    new Date().toISOString(),
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    partnerId: row.partner_id,
    driverId: row.driver_id,
    driverSlug: row.driver_slug,
  };
}

export function createSession(db: Sql, userId: string, token: string): void {
  const days = sessionDays();
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  run(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    cryptoRandomId(),
    userId,
    hashToken(token),
    expires,
    new Date().toISOString(),
  );
}

export function deleteSession(db: Sql, token: string | undefined): void {
  if (!token) return;
  run(db, `DELETE FROM sessions WHERE token_hash = ?`, hashToken(token));
}

function cryptoRandomId(): string {
  return randomBytes(16).toString("hex");
}

export async function login(
  db: Sql,
  email: string,
  password: string,
): Promise<{ user: SessionUser; token: string } | null> {
  const row = one<{ id: string; password_hash: string }>(
    db,
    `SELECT id, password_hash FROM users WHERE email = ?`,
    email,
  );
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  const token = newSessionToken();
  createSession(db, row.id, token);
  const user = userFromToken(db, token);
  if (!user) return null;
  return { user, token };
}
