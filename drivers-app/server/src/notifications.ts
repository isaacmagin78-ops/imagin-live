import { randomBytes } from "node:crypto";
import { formatMoney } from "../../shared/program.ts";
import { many, one, run, type Sql } from "./db.ts";
import type { NotificationRow } from "../../shared/types.ts";

export type NotifyInput = {
  kind: string;
  toAddress: string;
  body: string;
  relatedType: string;
  relatedId: string;
};

type NoteRow = {
  id: string;
  kind: string;
  to_address: string;
  body: string;
  status: string;
  detail: string;
  related_type: string;
  related_id: string;
  created_at: string;
};

export function toNotification(row: NoteRow): NotificationRow {
  return {
    id: row.id,
    kind: row.kind,
    toAddress: row.to_address,
    body: row.body,
    status: row.status,
    detail: row.detail,
    relatedType: row.related_type,
    relatedId: row.related_id,
    createdAt: row.created_at,
  };
}

function transportPlan(): { status: string; detail: string; send: boolean } {
  const mode = process.env.NOTIFY_MODE || "stub";
  const url = process.env.NOTIFY_WEBHOOK_URL || "";
  const allow = process.env.NOTIFY_ALLOW_NETWORK === "1";
  if (mode !== "webhook" || !url) {
    return {
      status: "stubbed",
      detail: "Stub only. NOTIFY_MODE is not a live sender. Nothing was sent.",
      send: false,
    };
  }
  if (!allow) {
    return {
      status: "stubbed",
      detail: "Webhook URL is set, but NOTIFY_ALLOW_NETWORK is not 1. Nothing was sent.",
      send: false,
    };
  }
  return { status: "sending", detail: "Webhook attempted.", send: true };
}

/** Writes the outbox. Performs HTTP only when NOTIFY_MODE=webhook, a URL is set, and NOTIFY_ALLOW_NETWORK=1. */
export async function enqueue(db: Sql, input: NotifyInput): Promise<NotificationRow> {
  const plan = transportPlan();
  const id = randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  run(
    db,
    `INSERT INTO notifications (id, kind, to_address, body, status, detail, related_type, related_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.kind,
    input.toAddress,
    input.body,
    plan.status,
    plan.detail,
    input.relatedType,
    input.relatedId,
    createdAt,
  );
  if (plan.send) {
    const url = process.env.NOTIFY_WEBHOOK_URL || "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          kind: input.kind,
          to: input.toAddress,
          body: input.body,
        }),
      });
      run(
        db,
        `UPDATE notifications SET status = ?, detail = ? WHERE id = ?`,
        res.ok ? "sent" : "failed",
        res.ok ? `Webhook HTTP ${res.status}.` : `Webhook HTTP ${res.status}. Response body was not stored.`,
        id,
      );
    } catch {
      run(
        db,
        `UPDATE notifications SET status = ?, detail = ? WHERE id = ?`,
        "failed",
        "Webhook request failed. Nothing else was retried.",
        id,
      );
    }
  }
  const row = one<NoteRow>(db, `SELECT * FROM notifications WHERE id = ?`, id);
  if (!row) throw new Error("notification missing after insert");
  return toNotification(row);
}

export function listNotifications(db: Sql, relatedId?: string): NotificationRow[] {
  const rows = relatedId
    ? many<NoteRow>(
        db,
        `SELECT * FROM notifications WHERE related_id = ? ORDER BY created_at DESC LIMIT 50`,
        relatedId,
      )
    : many<NoteRow>(db, `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`);
  return rows.map(toNotification);
}

export function quoteDraft(input: {
  riderName: string;
  driverFirstName: string;
  amountCents: number;
  pickupTime: string;
  rideDate: string;
  pickup: string;
  dropoff: string;
  statusUrl: string;
  note: string;
}): string {
  const lines = [
    `Hi ${input.riderName}, it's ${input.driverFirstName}.`,
    `Price: ${formatMoney(input.amountCents)}.`,
    `Pickup time: ${input.pickupTime}.`,
    `${input.rideDate}: ${input.pickup} → ${input.dropoff}.`,
  ];
  if (input.note) lines.push(input.note);
  lines.push(`Nothing is booked until you confirm: ${input.statusUrl}`);
  return lines.join("\n");
}

export function requestDraft(input: {
  driverFirstName: string;
  riderName: string;
  riderMobile: string;
  rideDate: string;
  rideTime: string;
  pickup: string;
  dropoff: string;
  passengers: number;
  notes: string;
  statusUrl: string;
}): string {
  return [
    `New request for ${input.driverFirstName}.`,
    `${input.riderName} · ${input.riderMobile}`,
    `${input.rideDate} ${input.rideTime}`,
    `Pickup: ${input.pickup}`,
    `Drop-off: ${input.dropoff}`,
    `Passengers: ${input.passengers}`,
    `Notes: ${input.notes || "none"}`,
    `Nothing is booked yet.`,
    input.statusUrl,
  ].join("\n");
}
