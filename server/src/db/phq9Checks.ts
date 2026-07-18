import type Database from "better-sqlite3";
import { nextGlobalSyncSeq } from "./syncCounter";

// Reihenfolge wie SPEC.md §3.3, ohne `date` (Primärschlüssel) und ohne
// `server_received_at`/`sync_seq`. `score` wird serverseitig aus `answers`
// berechnet, nie vom Client übernommen. Der Schweregrad-Text (§10) wird
// bewusst NICHT persistiert - er ist aus `score` ableitbar und gehört ins
// Frontend (Anzeige), nicht ins Schema (§3.3 sieht dafür keine Spalte vor).
export const PHQ9_COLUMNS = ["answers", "score", "updated_at", "deleted_at"] as const;

export interface Phq9CheckRecord {
  date: string;
  [key: string]: unknown;
}

interface Phq9CheckRow {
  date: string;
  server_received_at: string;
  [key: string]: unknown;
}

export class InvalidScaleError extends Error {}

// PHQ-9: 9 Items, je 0-3 (SPEC.md §3.3/§10).
export function validateAnswers(answers: unknown): number[] {
  if (!Array.isArray(answers) || answers.length !== 9) {
    throw new InvalidScaleError("answers muss ein Array mit genau 9 Werten sein");
  }
  for (const value of answers) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) {
      throw new InvalidScaleError(`answers-Wert außerhalb 0-3: ${JSON.stringify(value)}`);
    }
  }
  return answers as number[];
}

function toStorage(column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (column === "answers") return JSON.stringify(value);
  return value;
}

function fromStorage(column: string, value: unknown): unknown {
  if (column === "answers") return JSON.parse(value as string);
  return value;
}

function rowToRecord(row: Record<string, unknown>): Phq9CheckRecord {
  const record: Phq9CheckRecord = { date: row.date as string };
  for (const column of PHQ9_COLUMNS) {
    record[column] = fromStorage(column, row[column]);
  }
  record.server_received_at = row.server_received_at;
  return record;
}

function getByDate(db: Database.Database, date: string): Phq9CheckRow | undefined {
  return db.prepare("SELECT * FROM phq9_checks WHERE date = ?").get(date) as
    Phq9CheckRow | undefined;
}

function effectiveTimestamp(updatedAt: string, receivedAt: string): number {
  return Math.min(Date.parse(updatedAt), Date.parse(receivedAt));
}

export function upsertPhq9Check(db: Database.Database, incoming: Phq9CheckRecord): Phq9CheckRecord {
  const answers = validateAnswers(incoming.answers);
  const score = answers.reduce((sum, value) => sum + value, 0);
  const withComputedScore: Phq9CheckRecord = { ...incoming, answers, score };

  const now = new Date().toISOString();
  const existing = getByDate(db, withComputedScore.date);

  if (!existing) {
    const columns = ["date", ...PHQ9_COLUMNS, "server_received_at", "sync_seq"];
    const placeholders = columns.map(() => "?").join(", ");
    const values = [
      withComputedScore.date,
      ...PHQ9_COLUMNS.map((column) => toStorage(column, withComputedScore[column])),
      now,
      nextGlobalSyncSeq(db),
    ];
    db.prepare(`INSERT INTO phq9_checks (${columns.join(", ")}) VALUES (${placeholders})`).run(
      ...values,
    );
    return rowToRecord(getByDate(db, withComputedScore.date) as unknown as Record<string, unknown>);
  }

  const incomingEffective = effectiveTimestamp(withComputedScore.updated_at as string, now);
  const existingEffective = effectiveTimestamp(
    existing.updated_at as string,
    existing.server_received_at,
  );

  if (incomingEffective >= existingEffective) {
    const assignments = PHQ9_COLUMNS.map((column) => `${column} = ?`).join(", ");
    const values = [
      ...PHQ9_COLUMNS.map((column) => toStorage(column, withComputedScore[column])),
      now,
      nextGlobalSyncSeq(db),
      withComputedScore.date,
    ];
    db.prepare(
      `UPDATE phq9_checks SET ${assignments}, server_received_at = ?, sync_seq = ? WHERE date = ?`,
    ).run(...values);
  }

  return rowToRecord(getByDate(db, withComputedScore.date) as unknown as Record<string, unknown>);
}

export function listPhq9ChecksSince(
  db: Database.Database,
  since: string | undefined,
): Phq9CheckRecord[] {
  const sinceSeq = since ? Number(since) : 0;
  const rows = db
    .prepare("SELECT * FROM phq9_checks WHERE sync_seq > ? ORDER BY sync_seq")
    .all(Number.isFinite(sinceSeq) ? sinceSeq : 0);

  return (rows as Record<string, unknown>[]).map(rowToRecord);
}
