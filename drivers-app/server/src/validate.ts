import { SERVICE_ICONS, type ServiceIcon, type ServiceInput } from "../../shared/defaults.ts";

export function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.length > max) return null;
  return s;
}

export function optionalStr(value: unknown, max: number): string | null {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (s.length > max) return null;
  return s;
}

/** Booking pages show a first name only. From ride/sean/config.js. */
export function firstName(value: unknown): string | null {
  const s = str(value, 40);
  if (!s) return null;
  if (!/^[\p{L}][\p{L}'’-]{0,39}$/u.test(s)) return null;
  return s;
}

export function email(value: unknown): string | null {
  const s = str(value, 160)?.toLowerCase() ?? null;
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

export function slug(value: unknown): string | null {
  const s = str(value, 40)?.toLowerCase() ?? null;
  if (!s) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return null;
  if (s === "api" || s === "app" || s === "admin") return null;
  return s;
}

export function hexColor(value: unknown): string | null {
  const s = str(value, 7);
  if (!s || !/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase() === "#D4AF37" ? "#D4AF37" : s;
}

export function mobile(value: unknown): string | null {
  const s = str(value, 40);
  if (!s) return null;
  if (!/^[0-9+().\-\s]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return s;
}

/** International format required before a number is published. From config.js. */
export function internationalSms(value: unknown): string | null {
  const s = str(value, 20);
  if (!s || !/^\+[1-9]\d{9,14}$/.test(s)) return null;
  return s;
}

export function rideDate(value: unknown): string | null {
  const s = str(value, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

export function rideTime(value: unknown): string | null {
  const s = str(value, 5);
  if (!s || !/^\d{2}:\d{2}$/.test(s)) return null;
  const [h, min] = s.split(":").map(Number);
  if (h > 23 || min > 59) return null;
  return s;
}

export function passengers(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export function services(value: unknown): ServiceInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const out: ServiceInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    const icon = rec.icon;
    if (typeof icon !== "string" || !SERVICE_ICONS.includes(icon as ServiceIcon)) return null;
    const title = str(rec.title, 40);
    const detail = optionalStr(rec.detail, 60);
    if (!title || detail == null) return null;
    out.push({ icon: icon as ServiceIcon, title, detail });
  }
  return out;
}

export function trustLines(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 6) return null;
  const out: string[] = [];
  for (const line of value) {
    const s = str(line, 140);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

export function plan(value: unknown): "none" | "starter" | "monthly" | null {
  if (value === "none" || value === "starter" || value === "monthly") return value;
  return null;
}
