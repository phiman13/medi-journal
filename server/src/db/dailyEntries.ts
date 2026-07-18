import type Database from "better-sqlite3";
import { nextGlobalSyncSeq } from "./syncCounter";

// Reihenfolge wie SPEC.md §3.1, ohne `date` (Primärschlüssel, separat
// behandelt) und ohne `server_received_at`/`sync_seq` (werden vom Server gesetzt).
export const DAILY_ENTRY_COLUMNS = [
  "med_taken",
  "med_dose_mg",
  "med_time",
  "wear_off_time",
  "quetiapine_taken",
  "quetiapine_dose_mg",
  "focus",
  "task_initiation",
  "inner_calm",
  "emotional_stability",
  "mood",
  "day_function",
  "accomplished",
  "sleep_hours",
  "sleep_quality",
  "appetite",
  "resting_hr",
  "bp_sys",
  "bp_dia",
  "caffeine_units",
  "alcohol",
  "side_effects",
  "side_effects_other",
  "flags",
  "notes",
  "updated_at",
  "deleted_at",
] as const;

const BOOLEAN_COLUMNS = new Set(["med_taken", "quetiapine_taken", "alcohol"]);
const JSON_COLUMNS = new Set(["side_effects", "flags"]);

export interface DailyEntryRecord {
  date: string;
  [key: string]: unknown;
}

interface DailyEntryRow {
  date: string;
  server_received_at: string;
  sync_seq: number;
  [key: string]: unknown;
}

function toStorage(column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (BOOLEAN_COLUMNS.has(column)) return value === null ? null : value ? 1 : 0;
  if (JSON_COLUMNS.has(column)) return value === null ? null : JSON.stringify(value);
  return value;
}

function fromStorage(column: string, value: unknown): unknown {
  if (BOOLEAN_COLUMNS.has(column)) return value === null ? null : Boolean(value);
  if (JSON_COLUMNS.has(column))
    return value === null || value === undefined ? [] : JSON.parse(value as string);
  return value;
}

function rowToRecord(row: Record<string, unknown>): DailyEntryRecord {
  const record: DailyEntryRecord = { date: row.date as string };
  for (const column of DAILY_ENTRY_COLUMNS) {
    record[column] = fromStorage(column, row[column]);
  }
  record.server_received_at = row.server_received_at;
  return record;
}

function getByDate(db: Database.Database, date: string): DailyEntryRow | undefined {
  return db.prepare("SELECT * FROM daily_entries WHERE date = ?").get(date) as
    DailyEntryRow | undefined;
}

// Last-Write-Wins mit Server-Empfangszeit als Tiebreaker (SPEC.md §4.2).
// `effective` kappt eine in der Zukunft liegende Client-Uhr auf den
// Server-Empfangszeitpunkt, damit ein Gerät mit falsch gehender Systemzeit
// nicht dauerhaft gegen spätere, korrekt datierte Edits gewinnt.
function effectiveTimestamp(updatedAt: string, receivedAt: string): number {
  return Math.min(Date.parse(updatedAt), Date.parse(receivedAt));
}

export function upsertDailyEntry(
  db: Database.Database,
  incoming: DailyEntryRecord,
): DailyEntryRecord {
  const now = new Date().toISOString();
  const existing = getByDate(db, incoming.date);

  if (!existing) {
    const columns = ["date", ...DAILY_ENTRY_COLUMNS, "server_received_at", "sync_seq"];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [
      incoming.date,
      ...DAILY_ENTRY_COLUMNS.map((column) => toStorage(column, incoming[column])),
      now,
      nextGlobalSyncSeq(db),
    ];
    db.prepare(`INSERT INTO daily_entries (${columns.join(", ")}) VALUES (${placeholders})`).run(
      ...values,
    );
    return rowToRecord(getByDate(db, incoming.date) as unknown as Record<string, unknown>);
  }

  const incomingEffective = effectiveTimestamp(incoming.updated_at as string, now);
  const existingEffective = effectiveTimestamp(
    existing.updated_at as string,
    existing.server_received_at,
  );

  if (incomingEffective >= existingEffective) {
    const assignments = DAILY_ENTRY_COLUMNS.map((column) => `${column} = ?`).join(", ");
    const values = [
      ...DAILY_ENTRY_COLUMNS.map((column) => toStorage(column, incoming[column])),
      now,
      nextGlobalSyncSeq(db),
      incoming.date,
    ];
    db.prepare(
      `UPDATE daily_entries SET ${assignments}, server_received_at = ?, sync_seq = ? WHERE date = ?`,
    ).run(...values);
  }

  return rowToRecord(getByDate(db, incoming.date) as unknown as Record<string, unknown>);
}

export function listDailyEntriesSince(
  db: Database.Database,
  since: string | undefined,
): DailyEntryRecord[] {
  const sinceSeq = since ? Number(since) : 0;
  const rows = db
    .prepare("SELECT * FROM daily_entries WHERE sync_seq > ? ORDER BY sync_seq")
    .all(Number.isFinite(sinceSeq) ? sinceSeq : 0);

  return (rows as Record<string, unknown>[]).map(rowToRecord);
}
