# Driver QR app

A small full-stack app for the Personal Driver QR program. It sits in this folder so the static site at the repo root keeps working on GitHub Pages. GitHub Pages will not run it. The note at [index.html](index.html) only points back at the static pages.

The static pages it is modeled on:

- [drivers/index.html](../drivers/index.html) — partner calculator addressed to Sean
- [ride/sean/](../ride/sean/) — Sean's booking page (`config.js` is the hand-edited driver record)
- [lead.js](../lead.js) — every `data-lead` form, including Sean's ride request, posts into one shared lead inbox
- [drivers-qr.png](../drivers-qr.png) — QR that opens the static partner page, not a booking page

Nothing in those files is changed.

## What was manual

| Today | In this app |
| --- | --- |
| Copy `ride/sean/` and edit `config.js` for each driver | Admin creates a driver. The driver edits the same fields on Profile. |
| Leave `DRIVER_SMS` empty until a written yes | The number stays off the public page until someone checks publish and enters `+` country code and digits. |
| Ride requests fall into the shared lead inbox | A request is stored on that driver. The driver sees it. IMagin sees all of them. |
| The driver texts a price, and the rider replies to confirm | The driver types the price (there is no rate card in the repo). A draft text is stored. The rider confirms on the status link. Nothing is booked before that. No payment is taken. |
| "Tracked per driver" is a sentence on the calculator | A partner sees only drivers assigned to them, and only fees an admin recorded. |
| Someone keeps a notebook of the $99 setup and the $15 month | Admin clicks Record setup or Record month. The amounts are the ones printed on the partner page. 40% is stored when a partner is assigned. Nothing is charged. |
| A QR card is made by hand | The driver page has a print card and a QR for `/d/{slug}`. |

The year chart is the same script as the static page, including the script's assumption that a monthly driver's first month is not counted. The page calls that chart an illustration, not a promise. The ledger does not use that assumption.

## Architecture

```text
browser (React, Vite)
    │  same origin, cookie session
    ▼
Hono on Node 22
    ├── public booking + status
    ├── driver / partner / admin JSON
    └── notification outbox
            │
            ▼
        SQLite file (node:sqlite)
```

Roles:

- **Rider** — no account. Opens `/d/{slug}`, sends the same fields as the static form, then confirms or cancels on `/d/{slug}/r/{code}`.
- **Driver** — incoming requests, quote, profile, QR card.
- **Partner** — the calculator, plus a ledger of assigned drivers.
- **Admin (IMagin)** — create logins, mark a page live, assign a partner, record a fee, read requests and the outbox.

Seeded Sean is both the partner named on `drivers/index.html` and the driver in `ride/sean/config.js`, as two logins. His driver row is not assigned to his partner row, because the repo does not say he recruited that page. His plan is `none`, because the repo does not say he bought Starter or Monthly. His phone is empty, matching `DRIVER_SMS`.

One placeholder request is seeded so the inbox is not blank. It is labeled as a placeholder.

## Run locally

Node 22 or newer.

```bash
cd drivers-app
npm install
npm test
npm run seed
npm run dev
```

- API: http://127.0.0.1:8787
- UI with hot reload: http://127.0.0.1:5173 (proxies `/api`)

Or one process, after a build:

```bash
npm run build
npm start
```

Then open http://127.0.0.1:8787 and http://127.0.0.1:8787/d/sean

Placeholder logins, all with password `seed-local-only` (override with `SEED_PASSWORD` before seeding an empty database):

| Email | Who |
| --- | --- |
| `admin@example.com` | IMagin |
| `sean.partner@example.com` | Partner named Sean |
| `sean.driver@example.com` | Driver Sean |

`npm run seed` does nothing if `admin@example.com` is already in the database.

## Environment

Copy [.env.example](.env.example). The app runs with the defaults if you skip that. No real secrets are in the repo.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port. Default `8787`. |
| `DATABASE_PATH` | SQLite file. Default `./data/drivers.sqlite`. Ignored by git. |
| `PUBLIC_BASE_URL` | Origin baked into booking links, QR codes, and draft texts. |
| `SESSION_SECRET` | Pepper for session-token hashes. The placeholder is refused when `NODE_ENV=production`. |
| `COOKIE_SECURE` | Set to `1` behind HTTPS. |
| `SESSION_DAYS` | Sign-in length. Default 14. |
| `NOTIFY_MODE` | `stub` (default) or `webhook`. |
| `NOTIFY_WEBHOOK_URL` | Unused unless mode is `webhook`. |
| `NOTIFY_ALLOW_NETWORK` | Must be `1` before a webhook POST happens. Leave it `0`. |
| `SEED_PASSWORD` | Only read by `npm run seed`. |

Draft texts always land in the outbox. A webhook is attempted only when all three are set: mode `webhook`, a URL, and `NOTIFY_ALLOW_NETWORK=1`. This project does not turn that on and does not connect a provider.

## Tests

```bash
npm test
npm run typecheck
```

The tests cover the calculator numbers from the static page, Sean's public page with no phone, request intake, the honeypot, quote then confirm, driver isolation, the $99 / $15 ledger and 40% cut, and that a configured webhook URL does not call `fetch` unless the network flag is on.

## Deploy later (not done here)

Do not point GitHub Pages at this app and expect it to run. Pages can keep serving the static site.

This process is one Node server plus a SQLite file on disk.

- **Fly.io or Render**: run `npm ci && npm run build && npm start`. Put the SQLite file on a persistent volume (`DATABASE_PATH` on that disk). Set `NODE_ENV=production`, a long `SESSION_SECRET`, `PUBLIC_BASE_URL`, and `COOKIE_SECURE=1`.
- **Vercel**: a poor fit. Serverless instances do not keep a SQLite file. Use Fly or Render for this stack, or move the database later. This repo does not include that move.

Before a public host:

1. Change `SESSION_SECRET` and do not reuse the seed password.
2. Remove the placeholder request, or start from an empty database and create real logins.
3. Keep `NOTIFY_ALLOW_NETWORK` unset until someone chooses a real sender and writes the messages they actually want delivered.
4. Publish a driver mobile only after they have agreed in writing. The old `config.js` says the same thing.
5. Decide what the printed QR should open. `drivers-qr.png` still opens the static partner page.
6. Back up the SQLite file. There is no payment provider; the ledger is a record of what an admin clicked.
7. The old `ride/sean/` form still posts through `lead.js` until you stop using that page.

## Placeholders

Prices, the 40% cut, plan names, service titles, trust lines, and Sean's city and airport detail are copied from the static pages. Anything the repo does not state (ride fares, insurance, licensing, payouts, that Sean recruited himself) is left blank or marked as a placeholder.
