import type Database from "better-sqlite3";
import { nextGlobalSyncSeq } from "./syncCounter";

// Reihenfolge wie SPEC.md §3.2, ohne `week_start` (Primärschlüssel) und ohne
// `server_received_at`/`sync_seq` (werden vom Server gesetzt). `asrs_score`
// wird serverseitig aus `asrs` berechnet, nie vom Client übernommen.
export const WEEKLY_CHECK_COLUMNS = [
  "asrs",
  "asrs_score",
  "weight_kg",
  "bp_sys",
  "bp_dia",
  "hr",
  "effect_duration_h",
  "week_rating",
  "notes",
  "updated_at",
  "deleted_at",
] as const;

export interface WeeklyCheckRecord {
  week_start: string;
  [key: string]: unknown;
}

interface WeeklyCheckRow {
  week_start: string;
  server_received_at: string;
  [key: string]: unknown;
}

export class InvalidScaleError extends Error {}

// ASRS-6: 6 Items, je 0-4 (SPEC.md §3.2/§10). Wirft statt still zu klammern -
// ein falsch geformtes Array deutet auf einen Client-Bug hin, der auffallen
// soll, statt einen korrupten Score in die DB zu schreiben.
export function validateAsrs(asrs: unknown): number[] {
  if (!Array.isArray(asrs) || asrs.length !== 6) {
    throw new InvalidScaleError("asrs muss ein Array mit genau 6 Werten sein");
  }
  for (const value of asrs) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 4) {
      throw new InvalidScaleError(`asrs-Wert außerhalb 0-4: ${JSON.stringify(value)}`);
    }
  }
  return asrs as number[];
}

function toStorage(column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (column === "asrs") return JSON.stringify(value);
  return value;
}

function fromStorage(column: string, value: unknown): unknown {
  if (column === "asrs") return JSON.parse(value as string);
  return value;
}

function rowToRecord(row: Record<string, unknown>): WeeklyCheckRecord {
  const record: WeeklyCheckRecord = { week_start: row.week_start as string };
  for (const column of WEEKLY_CHECK_COLUMNS) {
    record[column] = fromStorage(column, row[column]);
  }
  record.server_received_at = row.server_received_at;
  return record;
}

function getByWeekStart(db: Database.Database, weekStart: string): WeeklyCheckRow | undefined {
  return db.prepare("SELECT * FROM weekly_checks WHERE week_start = ?").get(weekStart) as
    WeeklyCheckRow | undefined;
}

function effectiveTimestamp(updatedAt: string, receivedAt: string): number {
  return Math.min(Date.parse(updatedAt), Date.parse(receivedAt));
}

export function upsertWeeklyCheck(
  db: Database.Database,
  incoming: WeeklyCheckRecord,
): WeeklyCheckRecord {
  const asrs = validateAsrs(incoming.asrs);
  const asrsScore = asrs.reduce((sum, value) => sum + value, 0);
  const withComputedScore: WeeklyCheckRecord = { ...incoming, asrs, asrs_score: asrsScore };

  const now = new Date().toISOString();
  const existing = getByWeekStart(db, withComputedScore.week_start);

  if (!existing) {
    const columns = ["week_start", ...WEEKLY_CHECK_COLUMNS, "server_received_at", "sync_seq"];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [
      withComputedScore.week_start,
      ...WEEKLY_CHECK_COLUMNS.map((column) => toStorage(column, withComputedScore[column])),
      now,
      nextGlobalSyncSeq(db),
    ];
    db.prepare(`INSERT INTO weekly_checks (${columns.join(", ")}) VALUES (${placeholders})`).run(
      ...values,
    );
    return rowToRecord(
      getByWeekStart(db, withComputedScore.week_start) as unknown as Record<string, unknown>,
    );
  }

  const incomingEffective = effectiveTimestamp(withComputedScore.updated_at as string, now);
  const existingEffective = effectiveTimestamp(
    existing.updated_at as string,
    existing.server_received_at,
  );

  if (incomingEffective >= existingEffective) {
    const assignments = WEEKLY_CHECK_COLUMNS.map((column) => `${column} = ?`).join(", ");
    const values = [
      ...WEEKLY_CHECK_COLUMNS.map((column) => toStorage(column, withComputedScore[column])),
      now,
      nextGlobalSyncSeq(db),
      withComputedScore.week_start,
    ];
    db.prepare(
      `UPDATE weekly_checks SET ${assignments}, server_received_at = ?, sync_seq = ? WHERE week_start = ?`,
    ).run(...values);
  }

  return rowToRecord(
    getByWeekStart(db, withComputedScore.week_start) as unknown as Record<string, unknown>,
  );
}

export function listWeeklyChecksSince(
  db: Database.Database,
  since: string | undefined,
): WeeklyCheckRecord[] {
  const sinceSeq = since ? Number(since) : 0;
  const rows = db
    .prepare("SELECT * FROM weekly_checks WHERE sync_seq > ? ORDER BY sync_seq")
    .all(Number.isFinite(sinceSeq) ? sinceSeq : 0);

  return (rows as Record<string, unknown>[]).map(rowToRecord);
}
