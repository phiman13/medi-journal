import type Database from "better-sqlite3";
import { nextGlobalSyncSeq } from "./syncCounter";

// Reihenfolge wie SPEC.md §3.4, ohne `id` (Primärschlüssel) und ohne
// `server_received_at`/`sync_seq`.
export const EVENT_COLUMNS = [
  "date",
  "type",
  "title",
  "details",
  "updated_at",
  "deleted_at",
] as const;

export const EVENT_TYPES = [
  "dosisänderung",
  "medikament_start",
  "medikament_stopp",
  "arzttermin",
  "sonstiges",
] as const;

export interface EventRecord {
  id: string;
  [key: string]: unknown;
}

interface EventRow {
  id: string;
  server_received_at: string;
  [key: string]: unknown;
}

export class InvalidEventError extends Error {}

function validate(record: EventRecord): void {
  if (!record.id || typeof record.id !== "string") {
    throw new InvalidEventError("id fehlt");
  }
  if (!record.title || typeof record.title !== "string") {
    throw new InvalidEventError("title fehlt");
  }
  if (!(EVENT_TYPES as readonly string[]).includes(record.type as string)) {
    throw new InvalidEventError(`unbekannter event-type: ${JSON.stringify(record.type)}`);
  }
}

function rowToRecord(row: Record<string, unknown>): EventRecord {
  const record: EventRecord = { id: row.id as string };
  for (const column of EVENT_COLUMNS) {
    record[column] = row[column];
  }
  record.server_received_at = row.server_received_at;
  return record;
}

function getById(db: Database.Database, id: string): EventRow | undefined {
  return db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
}

function effectiveTimestamp(updatedAt: string, receivedAt: string): number {
  return Math.min(Date.parse(updatedAt), Date.parse(receivedAt));
}

export function upsertEvent(db: Database.Database, incoming: EventRecord): EventRecord {
  validate(incoming);

  const now = new Date().toISOString();
  const existing = getById(db, incoming.id);

  if (!existing) {
    const columns = ["id", ...EVENT_COLUMNS, "server_received_at", "sync_seq"];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [
      incoming.id,
      ...EVENT_COLUMNS.map((column) => incoming[column] ?? null),
      now,
      nextGlobalSyncSeq(db),
    ];
    db.prepare(`INSERT INTO events (${columns.join(", ")}) VALUES (${placeholders})`).run(
      ...values,
    );
    return rowToRecord(getById(db, incoming.id) as unknown as Record<string, unknown>);
  }

  const incomingEffective = effectiveTimestamp(incoming.updated_at as string, now);
  const existingEffective = effectiveTimestamp(
    existing.updated_at as string,
    existing.server_received_at,
  );

  if (incomingEffective >= existingEffective) {
    const assignments = EVENT_COLUMNS.map((column) => `${column} = ?`).join(", ");
    const values = [
      ...EVENT_COLUMNS.map((column) => incoming[column] ?? null),
      now,
      nextGlobalSyncSeq(db),
      incoming.id,
    ];
    db.prepare(
      `UPDATE events SET ${assignments}, server_received_at = ?, sync_seq = ? WHERE id = ?`,
    ).run(...values);
  }

  return rowToRecord(getById(db, incoming.id) as unknown as Record<string, unknown>);
}

export function listEventsSince(db: Database.Database, since: string | undefined): EventRecord[] {
  const sinceSeq = since ? Number(since) : 0;
  const rows = db
    .prepare("SELECT * FROM events WHERE sync_seq > ? ORDER BY sync_seq")
    .all(Number.isFinite(sinceSeq) ? sinceSeq : 0);

  return (rows as Record<string, unknown>[]).map(rowToRecord);
}
