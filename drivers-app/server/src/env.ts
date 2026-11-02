import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env without overriding variables that are already set. No dotenv dependency. */
export function loadEnv(cwd = process.cwd()): void {
  const file = resolve(cwd, ".env");
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
}

export function bookingUrl(slug: string): string {
  return `${publicBaseUrl()}/d/${slug}`;
}

export function statusUrl(slug: string, code: string): string {
  return `${publicBaseUrl()}/d/${slug}/r/${code}`;
}

export function sessionDays(): number {
  const n = Number(process.env.SESSION_DAYS || 14);
  if (!Number.isFinite(n) || n < 1 || n > 60) return 14;
  return n;
}

export function assertProductionSecret(): void {
  if (process.env.NODE_ENV !== "production") return;
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 24 || secret.includes("replace-me") || secret === "dev-only-session-pepper") {
    console.error("Set a long SESSION_SECRET before NODE_ENV=production.");
    process.exit(1);
  }
}
