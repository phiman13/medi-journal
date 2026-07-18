import type Database from "better-sqlite3";

// Global über alle Tabellen geteilter Zähler für den "since"-Cursor von
// GET /api/v1/sync - s. Kommentar in schema.sql (sync_counter) für die
// Begründung, warum ein Zähler pro Tabelle nicht funktioniert.
export function nextGlobalSyncSeq(db: Database.Database): number {
  db.prepare("UPDATE sync_counter SET value = value + 1 WHERE id = 1").run();
  const row = db.prepare("SELECT value FROM sync_counter WHERE id = 1").get() as { value: number };
  return row.value;
}

export function currentGlobalSyncSeq(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM sync_counter WHERE id = 1").get() as { value: number };
  return row.value;
}
