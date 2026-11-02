import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";
import { assertProductionSecret, loadEnv } from "./env.ts";

loadEnv();
assertProductionSecret();

const dbPath = process.env.DATABASE_PATH || "./data/drivers.sqlite";
const db = openDb(dbPath);
const app = createApp(db, { serveClient: true });
const port = Number(process.env.PORT || 8787);

if ((process.env.SESSION_SECRET || "").includes("replace-me") || !process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is a local placeholder. Fine on this machine. Change it before a public host.");
}
if ((process.env.NOTIFY_MODE || "stub") !== "stub" && process.env.NOTIFY_ALLOW_NETWORK === "1") {
  console.warn("NOTIFY_ALLOW_NETWORK=1. This process may POST to NOTIFY_WEBHOOK_URL.");
}

serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, (info) => {
  console.log(`Driver QR app at http://127.0.0.1:${info.port}`);
  console.log(`Database ${dbPath}`);
});
