import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Hono } from "hono";
import QRCode from "qrcode";
import { DISCLAIMER, PARTNER_CUT_PERCENT, MONTHLY_CENTS, SETUP_CENTS, dollarsToCents } from "../../shared/program.ts";
import type { FeeKind, PartnerOverview, Plan, SessionUser } from "../../shared/types.ts";
import { deleteSession, login, userFromToken } from "./auth.ts";
import { many, one, type Sql } from "./db.ts";
import {
  buildVcard,
  cancelRequest,
  confirmRequest,
  createDriver,
  createPartner,
  createRequest,
  declineRequest,
  getDriverById,
  getDriverBySlug,
  getDriverByUser,
  getRequestByCode,
  getRequestById,
  listAllRequests,
  listDriverRequests,
  listFees,
  quoteRequest,
  recordFee,
  saveProfile,
  toProfile,
  toPublic,
  toPublicRequest,
  toRequest,
  updateDriverAdmin,
} from "./domain.ts";
import { bookingUrl, sessionDays } from "./env.ts";
import { listNotifications } from "./notifications.ts";
import {
  email,
  firstName,
  hexColor,
  internationalSms,
  mobile,
  optionalStr,
  passengers,
  plan,
  rideDate,
  rideTime,
  services,
  slug,
  str,
  trustLines,
} from "./validate.ts";

const COOKIE = "dq_session";

async function bodyOf(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function currentUser(db: Sql, c: Context): SessionUser | null {
  return userFromToken(db, getCookie(c, COOKIE));
}

function requireRole(db: Sql, c: Context, roles: SessionUser["role"][]): SessionUser | Response {
  const user = currentUser(db, c);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  if (!roles.includes(user.role)) return c.json({ error: "Not allowed." }, 403);
  return user;
}

function isUser(value: SessionUser | Response): value is SessionUser {
  return !(value instanceof Response);
}

function httpStatus(status: number): 400 | 404 | 409 | 500 {
  if (status === 404 || status === 409 || status === 500) return status;
  return 400;
}

export function registerRoutes(app: Hono, db: Sql): void {
  app.get("/api/health", (c) => c.json({ ok: true, service: "drivers-app" }));

  app.post("/api/auth/login", async (c) => {
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const addr = email(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!addr || password.length < 8 || password.length > 200) {
      return c.json({ error: "Email or password is wrong." }, 401);
    }
    const result = await login(db, addr, password);
    if (!result) return c.json({ error: "Email or password is wrong." }, 401);
    setCookie(c, COOKIE, result.token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: process.env.COOKIE_SECURE === "1",
      maxAge: sessionDays() * 86400,
    });
    return c.json({ user: result.user });
  });

  app.post("/api/auth/logout", (c) => {
    deleteSession(db, getCookie(c, COOKIE));
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", (c) => {
    const user = currentUser(db, c);
    if (!user) return c.json({ error: "Sign in required." }, 401);
    return c.json({ user });
  });

  app.get("/api/public/drivers/:slug", (c) => {
    const row = getDriverBySlug(db, c.req.param("slug"));
    if (!row) return c.json({ error: "This booking page was not found." }, 404);
    const pub = toPublic(db, row);
    if (!pub) return c.json({ error: "This booking page is not live yet." }, 404);
    return c.json({ driver: pub });
  });

  app.get("/api/public/drivers/:slug/qr.svg", async (c) => {
    const row = getDriverBySlug(db, c.req.param("slug"));
    if (!row) return c.json({ error: "This booking page was not found." }, 404);
    const svg = await QRCode.toString(bookingUrl(row.slug), {
      type: "svg",
      margin: 1,
      color: { dark: "#0a0b0d", light: "#ffffff" },
    });
    return c.body(svg, 200, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-cache" });
  });

  app.get("/api/public/drivers/:slug/vcard", (c) => {
    const row = getDriverBySlug(db, c.req.param("slug"));
    if (!row) return c.json({ error: "This booking page was not found." }, 404);
    const pub = toPublic(db, row);
    if (!pub) return c.json({ error: "This booking page is not live yet." }, 404);
    const file = `${pub.firstName.replace(/[^\w-]+/g, "") || "driver"}.vcf`;
    return c.body(buildVcard(pub), 200, {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
    });
  });

  app.post("/api/public/drivers/:slug/requests", async (c) => {
    const row = getDriverBySlug(db, c.req.param("slug"));
    if (!row || row.active !== 1) return c.json({ error: "This booking page is not live yet." }, 404);
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const trap = typeof body.company === "string" ? body.company.trim() : "";
    if (trap) return c.json({ ok: true });
    const riderName = str(body.name, 120);
    const riderMobile = mobile(body.mobile);
    const pickup = str(body.pickup, 200);
    const dropoff = str(body.dropoff, 200);
    const date = rideDate(body.date);
    const time = rideTime(body.time);
    const count = passengers(body.passengers, row.max_passengers);
    const notes = optionalStr(body.notes, 2000);
    if (!riderName || !riderMobile || !pickup || !dropoff || !date || !time || count == null || notes == null) {
      return c.json({ error: "Check the name, mobile, pickup, drop-off, date, time, and passengers." }, 400);
    }
    const request = await createRequest(db, row, {
      riderName,
      riderMobile,
      pickup,
      dropoff,
      rideDate: date,
      rideTime: time,
      passengers: count,
      notes,
    });
    return c.json({ ok: true, code: request.code, statusUrl: request.statusUrl }, 201);
  });

  app.get("/api/public/requests/:code", (c) => {
    const row = getRequestByCode(db, c.req.param("code"));
    if (!row) return c.json({ error: "Request not found." }, 404);
    return c.json({ request: toPublicRequest(row) });
  });

  app.post("/api/public/requests/:code/confirm", async (c) => {
    const result = await confirmRequest(db, c.req.param("code"));
    if (!result.ok) return c.json({ error: result.error }, httpStatus(result.status));
    return c.json({ request: result.request });
  });

  app.post("/api/public/requests/:code/cancel", async (c) => {
    const result = await cancelRequest(db, c.req.param("code"));
    if (!result.ok) return c.json({ error: result.error }, httpStatus(result.status));
    return c.json({ request: result.request });
  });

  app.get("/api/driver/profile", (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    const row = getDriverByUser(db, user.id);
    if (!row) return c.json({ error: "Driver profile missing." }, 404);
    return c.json({ profile: toProfile(db, row) });
  });

  app.put("/api/driver/profile", async (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const name = firstName(body.firstName);
    if (!name) return c.json({ error: "First name only, never a last name." }, 400);
    const city = str(body.city, 80);
    if (!city) return c.json({ error: "City is required." }, 400);
    const accent = hexColor(body.accent);
    if (!accent) return c.json({ error: "Accent must be a hex color like #D4AF37." }, 400);
    const message = str(body.smsMessage, 200);
    if (!message) return c.json({ error: "The text-button message is required." }, 400);
    const max = passengers(body.maxPassengers, 12);
    if (max == null) return c.json({ error: "Passengers must be from 1 to 12." }, 400);
    const svc = services(body.services);
    if (!svc) return c.json({ error: "Add between 1 and 8 services. Icon must be plane, bag, glass, road, or star." }, 400);
    const trust = trustLines(body.trust);
    if (!trust) return c.json({ error: "Trust lines must be 6 or fewer, and none can be empty." }, 400);
    const publish = body.smsPublish === true;
    const smsRaw = optionalStr(body.sms, 40);
    if (smsRaw == null) return c.json({ error: "Check the mobile field." }, 400);
    let sms = smsRaw;
    if (publish) {
      const intl = internationalSms(sms);
      if (!intl) {
        return c.json({
          error: "Leave the number unpublished until the driver has agreed, in writing. To publish it, use international format: a plus sign, country code, digits only.",
        }, 400);
      }
      sms = intl;
    }
    saveProfile(db, user.driverId, {
      firstName: name,
      city,
      accent,
      sms,
      smsPublish: publish,
      smsMessage: message,
      maxPassengers: max,
      services: svc,
      trust,
    });
    const row = getDriverById(db, user.driverId);
    if (!row) return c.json({ error: "Driver profile missing." }, 404);
    return c.json({ profile: toProfile(db, row) });
  });

  app.get("/api/driver/requests", (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    return c.json({ requests: listDriverRequests(db, user.driverId) });
  });

  app.get("/api/driver/requests/:id", (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    const row = getRequestById(db, c.req.param("id"));
    if (!row || row.driver_id !== user.driverId) return c.json({ error: "Request not found." }, 404);
    return c.json({ request: toRequest(row), notifications: listNotifications(db, row.id) });
  });

  app.post("/api/driver/requests/:id/quote", async (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const amount = dollarsToCents(typeof body.amount === "string" ? body.amount : "");
    if (amount == null) return c.json({ error: "Enter the price you would text. There is no rate card on the current pages." }, 400);
    const note = optionalStr(body.note, 500);
    const pickupTime = rideTime(body.pickupTime);
    if (note == null || !pickupTime) return c.json({ error: "Pickup time is required." }, 400);
    const result = await quoteRequest(db, c.req.param("id"), user.driverId, { amountCents: amount, note, pickupTime });
    if (!result.ok) return c.json({ error: result.error }, httpStatus(result.status));
    return c.json({ request: result.request, notifications: listNotifications(db, result.request.id) });
  });

  app.post("/api/driver/requests/:id/decline", async (c) => {
    const user = requireRole(db, c, ["driver"]);
    if (!isUser(user) || !user.driverId) return user instanceof Response ? user : c.json({ error: "Driver profile missing." }, 404);
    const result = await declineRequest(db, c.req.param("id"), user.driverId);
    if (!result.ok) return c.json({ error: result.error }, httpStatus(result.status));
    return c.json({ request: result.request });
  });

  app.get("/api/partner/overview", (c) => {
    const user = requireRole(db, c, ["partner"]);
    if (!isUser(user) || !user.partnerId) return user instanceof Response ? user : c.json({ error: "Partner profile missing." }, 404);
    const rows = many<{
      id: string;
      first_name: string;
      slug: string;
      city: string;
      plan: Plan;
      active: number;
      fee_cents: number;
      cut_cents: number;
    }>(
      db,
      `SELECT d.id, d.first_name, d.slug, d.city, d.plan, d.active,
              COALESCE(SUM(f.amount_cents), 0) AS fee_cents,
              COALESCE(SUM(f.partner_cut_cents), 0) AS cut_cents
       FROM drivers d
       LEFT JOIN fee_events f ON f.driver_id = d.id AND f.partner_id = d.partner_id
       WHERE d.partner_id = ?
       GROUP BY d.id
       ORDER BY d.first_name`,
      user.partnerId,
    );
    const overview: PartnerOverview = {
      displayName: user.displayName,
      cutPercent: PARTNER_CUT_PERCENT,
      setupCents: SETUP_CENTS,
      monthlyCents: MONTHLY_CENTS,
      recordedCutCents: rows.reduce((sum, row) => sum + Number(row.cut_cents), 0),
      recordedFeeCents: rows.reduce((sum, row) => sum + Number(row.fee_cents), 0),
      drivers: rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        slug: row.slug,
        city: row.city,
        plan: row.plan,
        active: row.active === 1,
        feeCents: Number(row.fee_cents),
        cutCents: Number(row.cut_cents),
      })),
      disclaimer: DISCLAIMER,
    };
    return c.json({ overview });
  });

  app.get("/api/admin/overview", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const counts = one<{
      drivers: number;
      live: number;
      partners: number;
      requests: number;
      notifications: number;
    }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM drivers) AS drivers,
         (SELECT COUNT(*) FROM drivers WHERE active = 1) AS live,
         (SELECT COUNT(*) FROM partners) AS partners,
         (SELECT COUNT(*) FROM ride_requests) AS requests,
         (SELECT COUNT(*) FROM notifications) AS notifications`,
    );
    const byStatus = many<{ status: string; n: number }>(
      db,
      `SELECT status, COUNT(*) AS n FROM ride_requests GROUP BY status`,
    );
    return c.json({ counts, byStatus, partners: partnerList(db) });
  });

  app.get("/api/admin/partners", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    return c.json({ partners: partnerList(db) });
  });

  app.post("/api/admin/partners", async (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const name = firstName(body.displayName);
    const addr = email(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!name) return c.json({ error: "Partner name is a first name, matching the current page." }, 400);
    if (!addr) return c.json({ error: "Email is required." }, 400);
    if (password.length < 8 || password.length > 200) return c.json({ error: "Password must be at least 8 characters." }, 400);
    const created = await createPartner(db, { email: addr, password, displayName: name });
    if (!created.ok) return c.json({ error: created.error }, 409);
    return c.json({ id: created.id }, 201);
  });

  app.get("/api/admin/drivers", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const rows = many<{ id: string }>(db, `SELECT id FROM drivers ORDER BY first_name`);
    const drivers = rows
      .map((row) => getDriverById(db, row.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => toProfile(db, row));
    return c.json({ drivers, partners: partnerList(db) });
  });

  app.post("/api/admin/drivers", async (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const name = firstName(body.firstName);
    const driverSlug = slug(body.slug);
    const city = str(body.city, 80);
    const addr = email(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const chosenPlan = plan(body.plan ?? "none");
    const partnerId = body.partnerId == null || body.partnerId === "" ? null : str(body.partnerId, 80);
    if (!name) return c.json({ error: "First name only, never a last name." }, 400);
    if (!driverSlug) return c.json({ error: "Slug must be lowercase letters, numbers, and hyphens." }, 400);
    if (!city) return c.json({ error: "City is required." }, 400);
    if (!addr) return c.json({ error: "Email is required." }, 400);
    if (password.length < 8 || password.length > 200) return c.json({ error: "Password must be at least 8 characters." }, 400);
    if (!chosenPlan) return c.json({ error: "Plan must be none, starter, or monthly." }, 400);
    const created = await createDriver(db, {
      email: addr,
      password,
      firstName: name,
      slug: driverSlug,
      city,
      partnerId,
      plan: chosenPlan,
      active: body.active === true,
    });
    if (!created.ok) return c.json({ error: created.error }, 409);
    const row = getDriverById(db, created.id);
    if (!row) return c.json({ error: "Driver was not saved." }, 500);
    return c.json({ profile: toProfile(db, row) }, 201);
  });

  app.get("/api/admin/drivers/:id", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const row = getDriverById(db, c.req.param("id"));
    if (!row) return c.json({ error: "Driver not found." }, 404);
    return c.json({ profile: toProfile(db, row), fees: listFees(db, row.id), partners: partnerList(db) });
  });

  app.patch("/api/admin/drivers/:id", async (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const chosenPlan = plan(body.plan);
    if (!chosenPlan) return c.json({ error: "Plan must be none, starter, or monthly." }, 400);
    if (typeof body.active !== "boolean") return c.json({ error: "Say whether the page is live." }, 400);
    const partnerId = body.partnerId == null || body.partnerId === "" ? null : str(body.partnerId, 80);
    if (body.partnerId && !partnerId) return c.json({ error: "Partner id is not valid." }, 400);
    const updated = updateDriverAdmin(db, c.req.param("id"), { partnerId, plan: chosenPlan, active: body.active });
    if (!updated.ok) return c.json({ error: updated.error }, updated.error === "Driver not found." ? 404 : 400);
    const row = getDriverById(db, c.req.param("id"));
    if (!row) return c.json({ error: "Driver not found." }, 404);
    return c.json({ profile: toProfile(db, row) });
  });

  app.post("/api/admin/drivers/:id/fees", async (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    const body = await bodyOf(c);
    if (!body) return c.json({ error: "Expected JSON." }, 400);
    const kind = body.kind === "setup" || body.kind === "monthly" ? (body.kind as FeeKind) : null;
    if (!kind) return c.json({ error: "Fee kind must be setup or monthly." }, 400);
    const result = recordFee(db, c.req.param("id"), kind);
    if (!result.ok) return c.json({ error: result.error }, httpStatus(result.status));
    return c.json({ fee: result.fee, warning: result.warning }, 201);
  });

  app.get("/api/admin/requests", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    return c.json({ requests: listAllRequests(db) });
  });

  app.get("/api/admin/notifications", (c) => {
    const user = requireRole(db, c, ["admin"]);
    if (!isUser(user)) return user;
    return c.json({ notifications: listNotifications(db) });
  });
}

function partnerList(db: Sql): { id: string; displayName: string; email: string }[] {
  return many<{ id: string; display_name: string; email: string }>(
    db,
    `SELECT p.id, p.display_name, u.email
     FROM partners p JOIN users u ON u.id = p.user_id
     ORDER BY p.display_name`,
  ).map((row) => ({ id: row.id, displayName: row.display_name, email: row.email }));
}
