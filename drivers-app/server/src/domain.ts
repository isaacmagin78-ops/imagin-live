import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_ACCENT,
  DEFAULT_MAX_PASSENGERS,
  DEFAULT_SMS_MESSAGE,
  DEFAULT_TRUST,
  TEMPLATE_SERVICES,
  type ServiceInput,
} from "../../shared/defaults.ts";
import { MONTHLY_CENTS, PARTNER_CUT_BPS, SETUP_CENTS, partnerCutCents } from "../../shared/program.ts";
import type { DriverProfile, FeeEvent, FeeKind, Plan, PublicDriver, PublicRequest, RideRequest, Service } from "../../shared/types.ts";
import { hashPassword } from "./auth.ts";
import { many, one, run, tx, type Sql } from "./db.ts";
import { bookingUrl, statusUrl } from "./env.ts";
import { enqueue, quoteDraft, requestDraft } from "./notifications.ts";

export function nid(): string {
  return randomUUID();
}

type DriverRow = {
  id: string;
  user_id: string;
  partner_id: string | null;
  slug: string;
  first_name: string;
  city: string;
  accent: string;
  sms: string;
  sms_publish: number;
  sms_message: string;
  max_passengers: number;
  active: number;
  plan: Plan;
  plan_started_on: string | null;
  source_note: string;
  partner_name: string | null;
};

type RequestRow = {
  id: string;
  public_code: string;
  driver_id: string;
  rider_name: string;
  rider_mobile: string;
  pickup: string;
  dropoff: string;
  ride_date: string;
  ride_time: string;
  passengers: number;
  notes: string;
  status: RideRequest["status"];
  quote_amount_cents: number | null;
  quote_note: string | null;
  quoted_pickup_time: string | null;
  quoted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  driver_first_name: string;
  driver_slug: string;
  driver_city: string;
  driver_accent: string;
  driver_sms: string;
  driver_sms_publish: number;
  driver_sms_message: string;
};

type FeeRow = {
  id: string;
  driver_id: string;
  driver_first_name: string;
  partner_id: string | null;
  kind: FeeKind;
  amount_cents: number;
  partner_cut_cents: number;
  note: string;
  recorded_at: string;
};

const DRIVER_SELECT = `
  SELECT d.*, p.display_name AS partner_name
  FROM drivers d
  LEFT JOIN partners p ON p.id = d.partner_id
`;

const REQUEST_SELECT = `
  SELECT r.*,
         d.first_name AS driver_first_name,
         d.slug AS driver_slug,
         d.city AS driver_city,
         d.accent AS driver_accent,
         d.sms AS driver_sms,
         d.sms_publish AS driver_sms_publish,
         d.sms_message AS driver_sms_message
  FROM ride_requests r
  JOIN drivers d ON d.id = r.driver_id
`;

export function getDriverBySlug(db: Sql, slug: string): DriverRow | undefined {
  return one<DriverRow>(db, `${DRIVER_SELECT} WHERE d.slug = ?`, slug);
}

export function getDriverById(db: Sql, id: string): DriverRow | undefined {
  return one<DriverRow>(db, `${DRIVER_SELECT} WHERE d.id = ?`, id);
}

export function getDriverByUser(db: Sql, userId: string): DriverRow | undefined {
  return one<DriverRow>(db, `${DRIVER_SELECT} WHERE d.user_id = ?`, userId);
}

function servicesOf(db: Sql, driverId: string): Service[] {
  return many<{ icon: Service["icon"]; title: string; detail: string }>(
    db,
    `SELECT icon, title, detail FROM driver_services WHERE driver_id = ? ORDER BY sort_order`,
    driverId,
  );
}

function trustOf(db: Sql, driverId: string): string[] {
  return many<{ line: string }>(
    db,
    `SELECT line FROM driver_trust WHERE driver_id = ? ORDER BY sort_order`,
    driverId,
  ).map((row) => row.line);
}

export function toProfile(db: Sql, row: DriverRow): DriverProfile {
  return {
    id: row.id,
    slug: row.slug,
    firstName: row.first_name,
    city: row.city,
    accent: row.accent,
    sms: row.sms,
    smsPublish: row.sms_publish === 1,
    smsMessage: row.sms_message,
    maxPassengers: row.max_passengers,
    active: row.active === 1,
    plan: row.plan,
    planStartedOn: row.plan_started_on,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    services: servicesOf(db, row.id),
    trust: trustOf(db, row.id),
    bookingUrl: bookingUrl(row.slug),
    sourceNote: row.source_note,
  };
}

export function toPublic(db: Sql, row: DriverRow): PublicDriver | null {
  if (row.active !== 1) return null;
  return {
    slug: row.slug,
    firstName: row.first_name,
    city: row.city,
    accent: row.accent,
    sms: row.sms_publish === 1 && row.sms ? row.sms : null,
    smsMessage: row.sms_message,
    maxPassengers: row.max_passengers,
    services: servicesOf(db, row.id),
    trust: trustOf(db, row.id),
    bookingUrl: bookingUrl(row.slug),
    active: true,
  };
}

export function toRequest(row: RequestRow): RideRequest {
  return {
    id: row.id,
    code: row.public_code,
    driverId: row.driver_id,
    driverFirstName: row.driver_first_name,
    driverSlug: row.driver_slug,
    riderName: row.rider_name,
    riderMobile: row.rider_mobile,
    pickup: row.pickup,
    dropoff: row.dropoff,
    rideDate: row.ride_date,
    rideTime: row.ride_time,
    passengers: row.passengers,
    notes: row.notes,
    status: row.status,
    quoteAmountCents: row.quote_amount_cents,
    quoteNote: row.quote_note,
    quotedPickupTime: row.quoted_pickup_time,
    quotedAt: row.quoted_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    statusUrl: statusUrl(row.driver_slug, row.public_code),
  };
}

export function toPublicRequest(row: RequestRow): PublicRequest {
  return {
    code: row.public_code,
    driverFirstName: row.driver_first_name,
    driverSlug: row.driver_slug,
    city: row.driver_city,
    accent: row.driver_accent,
    sms: row.driver_sms_publish === 1 && row.driver_sms ? row.driver_sms : null,
    smsMessage: row.driver_sms_message,
    status: row.status,
    pickup: row.pickup,
    dropoff: row.dropoff,
    rideDate: row.ride_date,
    rideTime: row.ride_time,
    passengers: row.passengers,
    notes: row.notes,
    quoteAmountCents: row.quote_amount_cents,
    quoteNote: row.quote_note,
    quotedPickupTime: row.quoted_pickup_time,
    bookingUrl: bookingUrl(row.driver_slug),
    statusUrl: statusUrl(row.driver_slug, row.public_code),
  };
}

export function getRequestById(db: Sql, id: string): RequestRow | undefined {
  return one<RequestRow>(db, `${REQUEST_SELECT} WHERE r.id = ?`, id);
}

export function getRequestByCode(db: Sql, code: string): RequestRow | undefined {
  return one<RequestRow>(db, `${REQUEST_SELECT} WHERE r.public_code = ?`, code);
}

function replaceServices(db: Sql, driverId: string, services: ServiceInput[]): void {
  run(db, `DELETE FROM driver_services WHERE driver_id = ?`, driverId);
  services.forEach((service, index) => {
    run(
      db,
      `INSERT INTO driver_services (id, driver_id, icon, title, detail, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      nid(),
      driverId,
      service.icon,
      service.title,
      service.detail,
      index,
    );
  });
}

function replaceTrust(db: Sql, driverId: string, lines: string[]): void {
  run(db, `DELETE FROM driver_trust WHERE driver_id = ?`, driverId);
  lines.forEach((line, index) => {
    run(
      db,
      `INSERT INTO driver_trust (id, driver_id, line, sort_order) VALUES (?, ?, ?, ?)`,
      nid(),
      driverId,
      line,
      index,
    );
  });
}

export type CreateDriverInput = {
  email: string;
  password: string;
  firstName: string;
  slug: string;
  city: string;
  partnerId: string | null;
  plan: Plan;
  active: boolean;
  services?: ServiceInput[];
  trust?: string[];
  accent?: string;
  smsMessage?: string;
  sourceNote?: string;
};

export async function createDriver(db: Sql, input: CreateDriverInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (one(db, `SELECT id FROM users WHERE email = ?`, input.email)) {
    return { ok: false, error: "That email is already a login." };
  }
  if (one(db, `SELECT id FROM drivers WHERE slug = ?`, input.slug)) {
    return { ok: false, error: "That slug is already used." };
  }
  if (input.partnerId && !one(db, `SELECT id FROM partners WHERE id = ?`, input.partnerId)) {
    return { ok: false, error: "That partner was not found." };
  }
  const passwordHash = await hashPassword(input.password);
  const userId = nid();
  const driverId = nid();
  const now = new Date().toISOString();
  tx(db, () => {
    run(
      db,
      `INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, 'driver', ?, ?)`,
      userId,
      input.email,
      passwordHash,
      input.firstName,
      now,
    );
    run(
      db,
      `INSERT INTO drivers (
         id, user_id, partner_id, slug, first_name, city, accent, sms, sms_publish, sms_message,
         max_passengers, active, plan, plan_started_on, source_note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?, ?, ?, ?, ?, ?)`,
      driverId,
      userId,
      input.partnerId,
      input.slug,
      input.firstName,
      input.city,
      input.accent || DEFAULT_ACCENT,
      input.smsMessage || DEFAULT_SMS_MESSAGE,
      DEFAULT_MAX_PASSENGERS,
      input.active ? 1 : 0,
      input.plan,
      input.plan === "none" ? null : now.slice(0, 10),
      input.sourceNote || "Created in the app. Replaces a hand-copied ride/sean folder.",
      now,
    );
    replaceServices(db, driverId, input.services || TEMPLATE_SERVICES);
    replaceTrust(db, driverId, input.trust || DEFAULT_TRUST);
  });
  return { ok: true, id: driverId };
}

export async function createPartner(
  db: Sql,
  input: { email: string; password: string; displayName: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (one(db, `SELECT id FROM users WHERE email = ?`, input.email)) {
    return { ok: false, error: "That email is already a login." };
  }
  const passwordHash = await hashPassword(input.password);
  const userId = nid();
  const partnerId = nid();
  const now = new Date().toISOString();
  tx(db, () => {
    run(
      db,
      `INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, 'partner', ?, ?)`,
      userId,
      input.email,
      passwordHash,
      input.displayName,
      now,
    );
    run(
      db,
      `INSERT INTO partners (id, user_id, display_name, created_at) VALUES (?, ?, ?, ?)`,
      partnerId,
      userId,
      input.displayName,
      now,
    );
  });
  return { ok: true, id: partnerId };
}

export function saveProfile(
  db: Sql,
  driverId: string,
  input: {
    firstName: string;
    city: string;
    accent: string;
    sms: string;
    smsPublish: boolean;
    smsMessage: string;
    maxPassengers: number;
    services: ServiceInput[];
    trust: string[];
  },
): void {
  tx(db, () => {
    const row = getDriverById(db, driverId);
    if (!row) throw new Error("missing driver");
    run(
      db,
      `UPDATE drivers SET first_name = ?, city = ?, accent = ?, sms = ?, sms_publish = ?, sms_message = ?, max_passengers = ? WHERE id = ?`,
      input.firstName,
      input.city,
      input.accent,
      input.sms,
      input.smsPublish ? 1 : 0,
      input.smsMessage,
      input.maxPassengers,
      driverId,
    );
    run(db, `UPDATE users SET display_name = ? WHERE id = ?`, input.firstName, row.user_id);
    replaceServices(db, driverId, input.services);
    replaceTrust(db, driverId, input.trust);
  });
}

export function updateDriverAdmin(
  db: Sql,
  driverId: string,
  input: { partnerId: string | null; plan: Plan; active: boolean },
): { ok: true } | { ok: false; error: string } {
  const row = getDriverById(db, driverId);
  if (!row) return { ok: false, error: "Driver not found." };
  if (input.partnerId && !one(db, `SELECT id FROM partners WHERE id = ?`, input.partnerId)) {
    return { ok: false, error: "That partner was not found." };
  }
  const started =
    input.plan === "none" ? null : row.plan === input.plan && row.plan_started_on ? row.plan_started_on : new Date().toISOString().slice(0, 10);
  run(
    db,
    `UPDATE drivers SET partner_id = ?, plan = ?, active = ?, plan_started_on = ? WHERE id = ?`,
    input.partnerId,
    input.plan,
    input.active ? 1 : 0,
    started,
    driverId,
  );
  return { ok: true };
}

export type Intake = {
  riderName: string;
  riderMobile: string;
  pickup: string;
  dropoff: string;
  rideDate: string;
  rideTime: string;
  passengers: number;
  notes: string;
  code?: string;
};

export async function createRequest(db: Sql, driver: DriverRow, intake: Intake): Promise<RideRequest> {
  const id = nid();
  const code = intake.code || randomBytes(9).toString("base64url");
  const now = new Date().toISOString();
  run(
    db,
    `INSERT INTO ride_requests (
       id, public_code, driver_id, rider_name, rider_mobile, pickup, dropoff, ride_date, ride_time,
       passengers, notes, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)`,
    id,
    code,
    driver.id,
    intake.riderName,
    intake.riderMobile,
    intake.pickup,
    intake.dropoff,
    intake.rideDate,
    intake.rideTime,
    intake.passengers,
    intake.notes,
    now,
  );
  const row = getRequestById(db, id);
  if (!row) throw new Error("request missing");
  const address = driver.sms_publish === 1 && driver.sms ? driver.sms : driverLoginEmail(db, driver.user_id);
  await enqueue(db, {
    kind: "ride_requested",
    toAddress: address,
    body: requestDraft({
      driverFirstName: driver.first_name,
      riderName: intake.riderName,
      riderMobile: intake.riderMobile,
      rideDate: intake.rideDate,
      rideTime: intake.rideTime,
      pickup: intake.pickup,
      dropoff: intake.dropoff,
      passengers: intake.passengers,
      notes: intake.notes,
      statusUrl: statusUrl(driver.slug, code),
    }),
    relatedType: "ride_request",
    relatedId: id,
  });
  return toRequest(row);
}

function driverLoginEmail(db: Sql, userId: string): string {
  const row = one<{ email: string }>(db, `SELECT email FROM users WHERE id = ?`, userId);
  return row?.email || "driver";
}

export async function quoteRequest(
  db: Sql,
  requestId: string,
  driverId: string,
  input: { amountCents: number; note: string; pickupTime: string },
): Promise<{ ok: true; request: RideRequest } | { ok: false; status: number; error: string }> {
  const existing = getRequestById(db, requestId);
  if (!existing || existing.driver_id !== driverId) return { ok: false, status: 404, error: "Request not found." };
  if (existing.status !== "requested" && existing.status !== "quoted") {
    return { ok: false, status: 409, error: "That request can no longer be quoted." };
  }
  const now = new Date().toISOString();
  const changes = run(
    db,
    `UPDATE ride_requests
     SET status = 'quoted', quote_amount_cents = ?, quote_note = ?, quoted_pickup_time = ?, quoted_at = ?
     WHERE id = ? AND driver_id = ? AND status IN ('requested','quoted')`,
    input.amountCents,
    input.note || null,
    input.pickupTime,
    now,
    requestId,
    driverId,
  );
  if (changes !== 1) return { ok: false, status: 409, error: "That request can no longer be quoted." };
  const row = getRequestById(db, requestId);
  if (!row) return { ok: false, status: 404, error: "Request not found." };
  const kind = existing.status === "quoted" ? "quote_updated" : "quote_ready";
  await enqueue(db, {
    kind,
    toAddress: row.rider_mobile,
    body: quoteDraft({
      riderName: row.rider_name,
      driverFirstName: row.driver_first_name,
      amountCents: input.amountCents,
      pickupTime: input.pickupTime,
      rideDate: row.ride_date,
      pickup: row.pickup,
      dropoff: row.dropoff,
      statusUrl: statusUrl(row.driver_slug, row.public_code),
      note: input.note,
    }),
    relatedType: "ride_request",
    relatedId: requestId,
  });
  return { ok: true, request: toRequest(row) };
}

export async function declineRequest(
  db: Sql,
  requestId: string,
  driverId: string,
): Promise<{ ok: true; request: RideRequest } | { ok: false; status: number; error: string }> {
  const existing = getRequestById(db, requestId);
  if (!existing || existing.driver_id !== driverId) return { ok: false, status: 404, error: "Request not found." };
  if (existing.status !== "requested" && existing.status !== "quoted") {
    return { ok: false, status: 409, error: "That request can no longer be declined." };
  }
  const changes = run(
    db,
    `UPDATE ride_requests SET status = 'declined' WHERE id = ? AND driver_id = ? AND status IN ('requested','quoted')`,
    requestId,
    driverId,
  );
  if (changes !== 1) return { ok: false, status: 409, error: "That request can no longer be declined." };
  const row = getRequestById(db, requestId);
  if (!row) return { ok: false, status: 404, error: "Request not found." };
  await enqueue(db, {
    kind: "ride_declined",
    toAddress: row.rider_mobile,
    body: `${row.driver_first_name} declined this request. Nothing was booked.\n${row.pickup} → ${row.dropoff}`,
    relatedType: "ride_request",
    relatedId: requestId,
  });
  return { ok: true, request: toRequest(row) };
}

export async function confirmRequest(
  db: Sql,
  code: string,
): Promise<{ ok: true; request: PublicRequest } | { ok: false; status: number; error: string }> {
  const existing = getRequestByCode(db, code);
  if (!existing) return { ok: false, status: 404, error: "Request not found." };
  if (existing.status === "confirmed") return { ok: false, status: 409, error: "This ride is already confirmed." };
  if (existing.status !== "quoted") {
    return { ok: false, status: 409, error: "Nothing is booked until a price is ready to confirm." };
  }
  const now = new Date().toISOString();
  const changes = run(
    db,
    `UPDATE ride_requests SET status = 'confirmed', confirmed_at = ? WHERE public_code = ? AND status = 'quoted'`,
    now,
    code,
  );
  if (changes !== 1) return { ok: false, status: 409, error: "This ride can no longer be confirmed." };
  const row = getRequestByCode(db, code);
  if (!row) return { ok: false, status: 404, error: "Request not found." };
  const driver = getDriverById(db, row.driver_id);
  const address = driver && driver.sms_publish === 1 && driver.sms ? driver.sms : driver ? driverLoginEmail(db, driver.user_id) : "driver";
  await enqueue(db, {
    kind: "ride_confirmed",
    toAddress: address,
    body: `${row.rider_name} confirmed the ride. ${row.ride_date} ${row.quoted_pickup_time || row.ride_time}. ${row.pickup} → ${row.dropoff}.`,
    relatedType: "ride_request",
    relatedId: row.id,
  });
  return { ok: true, request: toPublicRequest(row) };
}

export async function cancelRequest(
  db: Sql,
  code: string,
): Promise<{ ok: true; request: PublicRequest } | { ok: false; status: number; error: string }> {
  const existing = getRequestByCode(db, code);
  if (!existing) return { ok: false, status: 404, error: "Request not found." };
  if (existing.status === "confirmed") {
    return { ok: false, status: 409, error: "This ride is already confirmed. The current pages do not say how to cancel after that." };
  }
  if (existing.status === "cancelled" || existing.status === "declined") {
    return { ok: false, status: 409, error: "This request is already closed." };
  }
  const changes = run(
    db,
    `UPDATE ride_requests SET status = 'cancelled' WHERE public_code = ? AND status IN ('requested','quoted')`,
    code,
  );
  if (changes !== 1) return { ok: false, status: 409, error: "This request can no longer be cancelled." };
  const row = getRequestByCode(db, code);
  if (!row) return { ok: false, status: 404, error: "Request not found." };
  const driver = getDriverById(db, row.driver_id);
  const address = driver && driver.sms_publish === 1 && driver.sms ? driver.sms : driver ? driverLoginEmail(db, driver.user_id) : "driver";
  await enqueue(db, {
    kind: "ride_cancelled",
    toAddress: address,
    body: `${row.rider_name} cancelled the request. Nothing was booked.`,
    relatedType: "ride_request",
    relatedId: row.id,
  });
  return { ok: true, request: toPublicRequest(row) };
}

export function listDriverRequests(db: Sql, driverId: string): RideRequest[] {
  return many<RequestRow>(
    db,
    `${REQUEST_SELECT} WHERE r.driver_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    driverId,
  ).map(toRequest);
}

export function listAllRequests(db: Sql): RideRequest[] {
  return many<RequestRow>(db, `${REQUEST_SELECT} ORDER BY r.created_at DESC LIMIT 200`).map(toRequest);
}

function feeNote(kind: FeeKind, attributed: boolean): string {
  const base =
    kind === "setup"
      ? "Setup fee from the partner page (Starter, $99 once). Recorded in this ledger. Not a charge and not sent to a payment provider."
      : "Monthly fee from the partner page ($15/mo). Recorded in this ledger. Not a charge and not sent to a payment provider.";
  return attributed ? base : `${base} No partner is assigned, so the 40% cut is not attributed.`;
}

export function recordFee(
  db: Sql,
  driverId: string,
  kind: FeeKind,
): { ok: true; fee: FeeEvent; warning: string | null } | { ok: false; status: number; error: string } {
  const driver = getDriverById(db, driverId);
  if (!driver) return { ok: false, status: 404, error: "Driver not found." };
  if (kind === "setup") {
    const prior = one(db, `SELECT id FROM fee_events WHERE driver_id = ? AND kind = 'setup'`, driverId);
    if (prior) return { ok: false, status: 409, error: "Setup fee is already recorded for this driver." };
  }
  const amount = kind === "setup" ? SETUP_CENTS : MONTHLY_CENTS;
  const attributed = Boolean(driver.partner_id);
  const cut = attributed ? partnerCutCents(amount) : 0;
  const id = nid();
  const now = new Date().toISOString();
  run(
    db,
    `INSERT INTO fee_events (id, driver_id, partner_id, kind, amount_cents, partner_cut_bps, partner_cut_cents, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    driverId,
    driver.partner_id,
    kind,
    amount,
    attributed ? PARTNER_CUT_BPS : 0,
    cut,
    feeNote(kind, attributed),
    now,
  );
  const fee = getFee(db, id);
  if (!fee) return { ok: false, status: 500, error: "Fee was not saved." };
  const expected = kind === "setup" ? "starter" : "monthly";
  const warning = driver.plan === expected ? null : `Recorded. The plan label is still ${driver.plan}.`;
  return { ok: true, fee, warning };
}

function getFee(db: Sql, id: string): FeeEvent | undefined {
  const row = one<FeeRow>(
    db,
    `SELECT f.id, f.driver_id, d.first_name AS driver_first_name, f.partner_id, f.kind, f.amount_cents, f.partner_cut_cents, f.note, f.recorded_at
     FROM fee_events f JOIN drivers d ON d.id = f.driver_id WHERE f.id = ?`,
    id,
  );
  return row ? toFee(row) : undefined;
}

function toFee(row: FeeRow): FeeEvent {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverFirstName: row.driver_first_name,
    partnerId: row.partner_id,
    kind: row.kind,
    amountCents: row.amount_cents,
    partnerCutCents: row.partner_cut_cents,
    note: row.note,
    recordedAt: row.recorded_at,
  };
}

export function listFees(db: Sql, driverId: string): FeeEvent[] {
  return many<FeeRow>(
    db,
    `SELECT f.id, f.driver_id, d.first_name AS driver_first_name, f.partner_id, f.kind, f.amount_cents, f.partner_cut_cents, f.note, f.recorded_at
     FROM fee_events f JOIN drivers d ON d.id = f.driver_id
     WHERE f.driver_id = ? ORDER BY f.recorded_at DESC`,
    driverId,
  ).map(toFee);
}

export function buildVcard(profile: PublicDriver): string {
  const first = profile.firstName;
  const url = profile.bookingUrl;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:;${vEsc(first)};;;`,
    `FN:${vEsc(first)}`,
    `item1.URL:${url}`,
    "item1.X-ABLabel:Book a ride",
    `NOTE:${vEsc(`Personal driver${profile.city ? ` in ${profile.city}` : ""}. Book your next ride: ${url}`)}`,
  ];
  if (profile.sms) lines.push(`TEL;TYPE=CELL:${profile.sms}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

function vEsc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
