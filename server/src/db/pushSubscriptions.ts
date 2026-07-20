import type Database from "better-sqlite3";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRow extends PushSubscriptionInput {
  id: number;
  created_at: string;
}

export class InvalidPushSubscriptionError extends Error {}

function validate(input: PushSubscriptionInput): void {
  if (!input.endpoint || typeof input.endpoint !== "string") {
    throw new InvalidPushSubscriptionError("endpoint fehlt");
  }
  if (!input.p256dh || typeof input.p256dh !== "string") {
    throw new InvalidPushSubscriptionError("keys.p256dh fehlt");
  }
  if (!input.auth || typeof input.auth !== "string") {
    throw new InvalidPushSubscriptionError("keys.auth fehlt");
  }
}

// Kein Sync-Record (s. schema.sql-Kommentar) - einfacher Upsert by endpoint
// statt LWW, ein Gerät hat immer nur eine aktuelle Subscription.
export function upsertPushSubscription(
  db: Database.Database,
  input: PushSubscriptionInput,
): PushSubscriptionRow {
  validate(input);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(input.endpoint, input.p256dh, input.auth, now);
  return db
    .prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
    .get(input.endpoint) as PushSubscriptionRow;
}

export function deletePushSubscription(db: Database.Database, endpoint: string): void {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function listPushSubscriptions(db: Database.Database): PushSubscriptionRow[] {
  return db.prepare("SELECT * FROM push_subscriptions").all() as PushSubscriptionRow[];
}
