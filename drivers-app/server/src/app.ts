import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { Hono } from "hono";
import type { Sql } from "./db.ts";
import { registerRoutes } from "./routes.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

export function createApp(db: Sql, opts?: { serveClient?: boolean; clientRoot?: string }): Hono {
  const app = new Hono();
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
  });
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Something went wrong." }, 500);
  });
  registerRoutes(app, db);
  if (opts?.serveClient) {
    const root = opts.clientRoot || join(process.cwd(), "dist");
    app.get("*", async (c) => serveClient(c.req.path, root));
  }
  app.notFound((c) => {
    if (c.req.path.startsWith("/api")) return c.json({ error: "Not found." }, 404);
    return c.text("Not found", 404);
  });
  return app;
}

async function serveClient(urlPath: string, root: string): Promise<Response> {
  if (urlPath.startsWith("/api")) return Response.json({ error: "Not found." }, { status: 404 });
  const rel = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath.split("?")[0] || "/");
  const full = normalize(join(root, rel));
  const rootN = normalize(root.endsWith(sep) ? root : root + sep);
  if (!full.startsWith(rootN) && normalize(root) !== full) return new Response("Not found", { status: 404 });
  if (existsSync(full) && statSync(full).isFile()) {
    const type = TYPES[extname(full)] || "application/octet-stream";
    const cache = extname(full) === ".html" ? "no-cache" : "public, max-age=86400";
    const stream = createReadStream(full);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: { "content-type": type, "cache-control": cache },
    });
  }
  if (extname(rel)) return new Response("Not found", { status: 404 });
  const index = join(root, "index.html");
  if (!existsSync(index)) {
    return new Response("App is not built. From drivers-app, run npm run build.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const html = await readFile(index, "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
}
