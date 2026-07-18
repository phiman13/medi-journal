import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import Database from "better-sqlite3";
import { openDb } from "../src/db";
import { upsertDailyEntry } from "../src/db/dailyEntries";
import { runBackup } from "../src/backup";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "medi-journal-backup-test-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function seedDb(): { db: Database.Database; dbPath: string } {
  const dbPath = join(workDir, "source.sqlite");
  const db = openDb(dbPath);
  upsertDailyEntry(db, {
    date: "2026-07-18",
    med_taken: true,
    focus: 7,
    task_initiation: 6,
    inner_calm: 6,
    emotional_stability: 6,
    mood: 7,
    day_function: 7,
    updated_at: new Date().toISOString(),
    notes: "Test-Eintrag für Backup",
  });
  return { db, dbPath };
}

describe("runBackup", () => {
  it("erzeugt ein Daily- und ein Monthly-Backup beim ersten Lauf", async () => {
    const { db } = seedDb();
    const backupDir = join(workDir, "backups");

    const result = await runBackup(db, backupDir, new Date("2026-07-18T22:00:00.000Z"));

    expect(result.dailyCreated).toBe(true);
    expect(result.monthlyCreated).toBe(true);
    expect(existsSync(join(backupDir, "daily", "medi-journal-2026-07-18.sqlite.gz"))).toBe(true);
    expect(existsSync(join(backupDir, "monthly", "medi-journal-2026-07.sqlite.gz"))).toBe(true);
  });

  it("ist idempotent - kein Zusatz-Backup am selben Tag", async () => {
    const { db } = seedDb();
    const backupDir = join(workDir, "backups");
    const now = new Date("2026-07-18T22:00:00.000Z");

    await runBackup(db, backupDir, now);
    const second = await runBackup(db, backupDir, now);

    expect(second.dailyCreated).toBe(false);
    expect(second.monthlyCreated).toBe(false);
  });

  it("das Daily-Backup ist ein echtes, wiederherstellbares SQLite-Backup (AK3)", async () => {
    const { db } = seedDb();
    const backupDir = join(workDir, "backups");

    await runBackup(db, backupDir, new Date("2026-07-18T22:00:00.000Z"));

    const gz = readFileSync(join(backupDir, "daily", "medi-journal-2026-07-18.sqlite.gz"));
    const restoredPath = join(workDir, "restored.sqlite");
    writeFileSync(restoredPath, gunzipSync(gz));

    const restoredDb = new Database(restoredPath, { readonly: true });
    const row = restoredDb
      .prepare("SELECT * FROM daily_entries WHERE date = ?")
      .get("2026-07-18") as {
      notes: string;
    };
    expect(row.notes).toBe("Test-Eintrag für Backup");
    restoredDb.close();
  });

  it("räumt Daily-Backups auf, die älter als 30 Tage sind", async () => {
    const { db } = seedDb();
    const backupDir = join(workDir, "backups");
    const dailyDir = join(backupDir, "daily");
    mkdirSync(dailyDir, { recursive: true });

    const oldFile = "medi-journal-2026-05-01.sqlite.gz";
    const recentFile = "medi-journal-2026-06-25.sqlite.gz";
    writeFileSync(join(dailyDir, oldFile), gzipSync(Buffer.from("dummy")));
    writeFileSync(join(dailyDir, recentFile), gzipSync(Buffer.from("dummy")));

    const result = await runBackup(db, backupDir, new Date("2026-07-18T22:00:00.000Z"));

    expect(result.prunedDaily).toContain(oldFile);
    expect(result.prunedDaily).not.toContain(recentFile);
    expect(existsSync(join(dailyDir, recentFile))).toBe(true);
  });

  it("räumt Monthly-Backups auf, die älter als 12 Monate sind", async () => {
    const { db } = seedDb();
    const backupDir = join(workDir, "backups");
    const monthlyDir = join(backupDir, "monthly");
    mkdirSync(monthlyDir, { recursive: true });

    const oldFile = "medi-journal-2024-01.sqlite.gz";
    writeFileSync(join(monthlyDir, oldFile), gzipSync(Buffer.from("dummy")));

    const result = await runBackup(db, backupDir, new Date("2026-07-18T22:00:00.000Z"));

    expect(result.prunedMonthly).toContain(oldFile);
  });
});
