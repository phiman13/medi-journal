import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openDb } from "../src/db";
import { upsertWeeklyCheck } from "../src/db/weeklyChecks";

let workDir: string;

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

// Regression: `CREATE TABLE IF NOT EXISTS` in schema.sql ändert eine bereits
// existierende Tabelle nicht nach. Dieser Test simuliert eine DB-Datei, die
// noch vor M4a (server_received_at/sync_seq auf weekly_checks/phq9_checks)
// angelegt wurde, und prüft, dass openDb() die fehlenden Spalten nachrüstet
// (im eigenen lokalen Testlauf als echter SQLITE_ERROR gefunden, s. lib/db/index.ts).
describe("openDb Migration", () => {
  it("rüstet server_received_at/sync_seq auf einer alten weekly_checks-Tabelle nach", () => {
    workDir = mkdtempSync(join(tmpdir(), "medi-journal-db-migration-test-"));
    const dbPath = join(workDir, "legacy.sqlite");

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE weekly_checks (
        week_start TEXT PRIMARY KEY,
        asrs TEXT NOT NULL,
        asrs_score INTEGER NOT NULL,
        weight_kg REAL,
        bp_sys INTEGER,
        bp_dia INTEGER,
        hr INTEGER,
        effect_duration_h REAL,
        week_rating TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
    `);
    legacyDb.close();

    const db = openDb(dbPath);
    const columns = (
      db.prepare("PRAGMA table_info(weekly_checks)").all() as { name: string }[]
    ).map((column) => column.name);
    expect(columns).toContain("server_received_at");
    expect(columns).toContain("sync_seq");

    expect(() =>
      upsertWeeklyCheck(db, {
        week_start: "2026-07-13",
        asrs: [1, 1, 1, 1, 1, 1],
        updated_at: new Date().toISOString(),
      }),
    ).not.toThrow();
  });
});
