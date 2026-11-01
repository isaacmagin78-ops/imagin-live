import { SEAN_CITY, SEAN_FIRST_NAME, SEAN_SERVICES, DEFAULT_ACCENT, DEFAULT_SMS_MESSAGE, DEFAULT_TRUST } from "../../shared/defaults.ts";
import { hashPassword } from "./auth.ts";
import { openDb, one, run, tx, type Sql } from "./db.ts";
import { createRequest, getDriverBySlug, nid } from "./domain.ts";
import { loadEnv } from "./env.ts";

const PASSWORD = process.env.SEED_PASSWORD || "seed-local-only";

function tomorrow(): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Idempotent seed from drivers/index.html and ride/sean/config.js. */
export async function seed(db: Sql, password = PASSWORD): Promise<void> {
  if (one(db, `SELECT id FROM users WHERE email = ?`, "admin@example.com")) return;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const adminId = nid();
  const partnerUserId = nid();
  const driverUserId = nid();
  const partnerId = nid();
  const driverId = nid();

  tx(db, () => {
    run(
      db,
      `INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, 'admin', 'IMagin', ?)`,
      adminId,
      "admin@example.com",
      passwordHash,
      now,
    );
    run(
      db,
      `INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, 'partner', ?, ?)`,
      partnerUserId,
      "sean.partner@example.com",
      passwordHash,
      SEAN_FIRST_NAME,
      now,
    );
    run(
      db,
      `INSERT INTO partners (id, user_id, display_name, created_at) VALUES (?, ?, ?, ?)`,
      partnerId,
      partnerUserId,
      SEAN_FIRST_NAME,
      now,
    );
    run(
      db,
      `INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, 'driver', ?, ?)`,
      driverUserId,
      "sean.driver@example.com",
      passwordHash,
      SEAN_FIRST_NAME,
      now,
    );
    run(
      db,
      `INSERT INTO drivers (
         id, user_id, partner_id, slug, first_name, city, accent, sms, sms_publish, sms_message,
         max_passengers, active, plan, plan_started_on, source_note, created_at
       ) VALUES (?, ?, NULL, 'sean', ?, ?, ?, '', 0, ?, 4, 1, 'none', NULL, ?, ?)`,
      driverId,
      driverUserId,
      SEAN_FIRST_NAME,
      SEAN_CITY,
      DEFAULT_ACCENT,
      DEFAULT_SMS_MESSAGE,
      "Seeded from ride/sean/config.js. DRIVER_SMS is empty, so the number is not published. Not attributed to the partner ledger: the partner page is a pitch to Sean, and the repo does not say he recruited this page.",
      now,
    );
    SEAN_SERVICES.forEach((service, index) => {
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
    DEFAULT_TRUST.forEach((line, index) => {
      run(
        db,
        `INSERT INTO driver_trust (id, driver_id, line, sort_order) VALUES (?, ?, ?, ?)`,
        nid(),
        driverId,
        line,
        index,
      );
    });
  });

  const driver = getDriverBySlug(db, "sean");
  if (!driver) throw new Error("seed driver missing");
  await createRequest(db, driver, {
    riderName: "Placeholder Rider",
    riderMobile: "+15555550100",
    pickup: "Placeholder pickup",
    dropoff: "Placeholder drop-off",
    rideDate: tomorrow(),
    rideTime: "09:00",
    passengers: 1,
    notes: "Seed placeholder. Not a real request.",
    code: "seed-placeholder",
  });
}

async function main(): Promise<void> {
  loadEnv();
  const db = openDb(process.env.DATABASE_PATH || "./data/drivers.sqlite");
  await seed(db);
  console.log("Seed ready.");
  console.log("Placeholder logins (not real accounts), password:", PASSWORD);
  console.log("  admin@example.com            IMagin admin");
  console.log("  sean.partner@example.com     partner named on drivers/index.html");
  console.log("  sean.driver@example.com      driver from ride/sean/config.js");
  console.log("Booking page: /d/sean");
}

const entry = process.argv[1] || "";
if (entry.endsWith("seed.ts") || entry.endsWith("seed.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
