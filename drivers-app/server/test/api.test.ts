import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { openDb, one, type Sql } from "../src/db.ts";
import { seed } from "../src/seed.ts";

const PASSWORD = "seed-local-only";

async function login(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("missing session cookie");
  return cookie;
}

function authed(cookie: string, body?: unknown, method = "GET"): RequestInit {
  const init: RequestInit = { method, headers: { cookie } };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return init;
}

describe("drivers API", () => {
  let db: Sql;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    process.env.NOTIFY_MODE = "stub";
    process.env.NOTIFY_WEBHOOK_URL = "";
    process.env.NOTIFY_ALLOW_NETWORK = "0";
    process.env.PUBLIC_BASE_URL = "http://localhost:8787";
    db = openDb(":memory:");
    await seed(db, PASSWORD);
    app = createApp(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    db.close();
  });

  it("serves Sean's booking page without a phone", async () => {
    const res = await app.request("/api/public/drivers/sean");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.driver.firstName).toBe("Sean");
    expect(body.driver.city).toBe("South Florida");
    expect(body.driver.sms).toBeNull();
    expect(body.driver.services[0]).toMatchObject({ title: "Airport", detail: "FLL / PBI / MIA" });
    expect(body.driver.trust).toContain("Same driver every time");
  });

  it("builds a contact card with no telephone when the number is unpublished", async () => {
    const res = await app.request("/api/public/drivers/sean/vcard");
    const text = await res.text();
    expect(text).toContain("FN:Sean");
    expect(text).not.toContain("TEL");
  });

  it("rejects a bad login and accepts the seed admin", async () => {
    const bad = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "not-the-password" }),
    });
    expect(bad.status).toBe(401);
    const cookie = await login(app, "admin@example.com");
    const me = await app.request("/api/auth/me", authed(cookie));
    expect((await me.json()).user.role).toBe("admin");
  });

  it("stores a ride request and a stub notification, and does not call fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NOTIFY_MODE = "webhook";
    process.env.NOTIFY_WEBHOOK_URL = "https://example.invalid/hook";
    const res = await app.request("/api/public/drivers/sean/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Ava Rider",
        mobile: "(954) 555-0199",
        pickup: "FLL Terminal 1",
        dropoff: "Placeholder hotel",
        date: "2026-12-01",
        time: "14:30",
        passengers: 2,
        notes: "Flight later",
        company: "",
      }),
    });
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    const created = await res.json();
    const note = one<{ status: string; detail: string }>(
      db,
      `SELECT status, detail FROM notifications WHERE kind = 'ride_requested' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(note?.status).toBe("stubbed");
    expect(note?.detail).toMatch(/Nothing was sent/);
    const status = await app.request(`/api/public/requests/${created.code}`);
    const view = await status.json();
    expect(view.request.status).toBe("requested");
    expect(view.request.riderMobile).toBeUndefined();
  });

  it("ignores the honeypot without storing a request", async () => {
    const before = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ride_requests`);
    const res = await app.request("/api/public/drivers/sean/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "spam", name: "Bot" }),
    });
    expect(res.status).toBe(200);
    const after = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ride_requests`);
    expect(after?.n).toBe(before?.n);
  });

  it("lets the driver quote and the rider confirm", async () => {
    const driver = await login(app, "sean.driver@example.com");
    const list = await app.request("/api/driver/requests", authed(driver));
    const requests = (await list.json()).requests;
    const placeholder = requests.find((row: { code: string }) => row.code === "seed-placeholder");
    expect(placeholder.riderName).toBe("Placeholder Rider");

    const tooSoon = await app.request(`/api/public/requests/${placeholder.code}/confirm`, { method: "POST" });
    expect(tooSoon.status).toBe(409);

    const missing = await app.request(
      `/api/driver/requests/${placeholder.id}/quote`,
      authed(driver, { amount: "", pickupTime: "09:15", note: "" }, "POST"),
    );
    expect(missing.status).toBe(400);

    const quoted = await app.request(
      `/api/driver/requests/${placeholder.id}/quote`,
      authed(driver, { amount: "123.45", pickupTime: "09:15", note: "Driver-entered placeholder, not a published rate." }, "POST"),
    );
    expect(quoted.status).toBe(200);
    const quoteBody = await quoted.json();
    expect(quoteBody.request.quoteAmountCents).toBe(12345);
    expect(quoteBody.notifications[0].status).toBe("stubbed");
    expect(quoteBody.notifications[0].body).toContain("123.45");
    expect(quoteBody.notifications[0].body).toContain("Nothing is booked until you confirm");

    const confirmed = await app.request(`/api/public/requests/${placeholder.code}/confirm`, { method: "POST" });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).request.status).toBe("confirmed");

    const again = await app.request(`/api/public/requests/${placeholder.code}/confirm`, { method: "POST" });
    expect(again.status).toBe(409);
  });

  it("hides one driver's requests from another driver", async () => {
    const admin = await login(app, "admin@example.com");
    const created = await app.request(
      "/api/admin/drivers",
      authed(
        admin,
        {
          firstName: "Ada",
          slug: "ada",
          city: "Placeholder city",
          email: "ada.driver@example.com",
          password: PASSWORD,
          plan: "none",
          active: false,
        },
        "POST",
      ),
    );
    expect(created.status).toBe(201);
    const ada = await login(app, "ada.driver@example.com");
    const list = await app.request("/api/driver/requests", authed(ada));
    expect((await list.json()).requests).toEqual([]);
    const hidden = await app.request("/api/public/drivers/ada");
    expect(hidden.status).toBe(404);
    const profile = (await (await app.request("/api/admin/drivers", authed(admin))).json()).drivers.find(
      (row: { slug: string }) => row.slug === "ada",
    );
    const live = await app.request(
      `/api/admin/drivers/${profile.id}`,
      authed(admin, { partnerId: null, plan: "none", active: true }, "PATCH"),
    );
    expect(live.status).toBe(200);
    expect((await app.request("/api/public/drivers/ada")).status).toBe(200);
  });

  it("records the printed fees and the 40% cut only when a partner is assigned", async () => {
    const admin = await login(app, "admin@example.com");
    const partners = (await (await app.request("/api/admin/partners", authed(admin))).json()).partners;
    const sean = partners.find((row: { displayName: string }) => row.displayName === "Sean");
    const drivers = (await (await app.request("/api/admin/drivers", authed(admin))).json()).drivers;
    const driver = drivers.find((row: { slug: string }) => row.slug === "sean");

    const unassigned = await app.request(
      `/api/admin/drivers/${driver.id}/fees`,
      authed(admin, { kind: "monthly" }, "POST"),
    );
    expect(unassigned.status).toBe(201);
    expect((await unassigned.json()).fee.partnerCutCents).toBe(0);

    const assigned = await app.request(
      `/api/admin/drivers/${driver.id}`,
      authed(admin, { partnerId: sean.id, plan: "starter", active: true }, "PATCH"),
    );
    expect(assigned.status).toBe(200);

    const setup = await app.request(
      `/api/admin/drivers/${driver.id}/fees`,
      authed(admin, { kind: "setup" }, "POST"),
    );
    expect(setup.status).toBe(201);
    expect((await setup.json()).fee).toMatchObject({ amountCents: 9900, partnerCutCents: 3960 });

    const twice = await app.request(
      `/api/admin/drivers/${driver.id}/fees`,
      authed(admin, { kind: "setup" }, "POST"),
    );
    expect(twice.status).toBe(409);

    const partner = await login(app, "sean.partner@example.com");
    const overview = await (await app.request("/api/partner/overview", authed(partner))).json();
    expect(overview.overview.recordedCutCents).toBe(3960);
    expect(overview.overview.drivers).toHaveLength(1);
    expect(overview.overview.drivers[0].firstName).toBe("Sean");

    const other = await app.request(
      "/api/admin/partners",
      authed(admin, { displayName: "Riley", email: "riley.partner@example.com", password: PASSWORD }, "POST"),
    );
    expect(other.status).toBe(201);
    const riley = await login(app, "riley.partner@example.com");
    const empty = await (await app.request("/api/partner/overview", authed(riley))).json();
    expect(empty.overview.drivers).toEqual([]);
    expect(empty.overview.recordedCutCents).toBe(0);
  });

  it("refuses to publish a driver number without the written-consent format", async () => {
    const driver = await login(app, "sean.driver@example.com");
    const profile = (await (await app.request("/api/driver/profile", authed(driver))).json()).profile;
    const res = await app.request(
      "/api/driver/profile",
      authed(
        driver,
        {
          ...profile,
          sms: "9545550100",
          smsPublish: true,
        },
        "PUT",
      ),
    );
    expect(res.status).toBe(400);
    const blocked = await app.request("/api/public/drivers/sean");
    expect((await blocked.json()).driver.sms).toBeNull();
  });

  it("blocks a driver from the admin ledger", async () => {
    const driver = await login(app, "sean.driver@example.com");
    const res = await app.request("/api/admin/overview", authed(driver));
    expect(res.status).toBe(403);
  });
});
