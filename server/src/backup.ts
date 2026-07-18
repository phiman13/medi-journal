import type Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DAILY_RETENTION_DAYS = 30;
const MONTHLY_RETENTION_MONTHS = 12;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yearMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

async function writeGzippedBackup(db: Database.Database, destPath: string): Promise<void> {
  const tmpPath = `${destPath}.tmp.sqlite`;
  await db.backup(tmpPath);
  const raw = readFileSync(tmpPath);
  writeFileSync(destPath, gzipSync(raw));
  unlinkSync(tmpPath);
}

function pruneOldFiles(dir: string, isExpired: (filename: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const filename of readdirSync(dir)) {
    if (isExpired(filename)) {
      unlinkSync(join(dir, filename));
      removed.push(filename);
    }
  }
  return removed;
}

export interface BackupResult {
  dailyCreated: boolean;
  monthlyCreated: boolean;
  prunedDaily: string[];
  prunedMonthly: string[];
}

// Nächtlicher Backup-Cron (SPEC.md §4.4): .backup() ist SQLites Online-
// Backup-API, sicher neben gleichzeitigen Schreibzugriffen. Idempotent pro
// Kalendertag/-monat (existsSync-Check) - ein Neustart oder mehrere Ticks am
// selben Tag erzeugen kein Zusatz-Backup und verwässern nicht die Retention.
export async function runBackup(
  db: Database.Database,
  backupDir: string,
  now = new Date(),
): Promise<BackupResult> {
  const dailyDir = join(backupDir, "daily");
  const monthlyDir = join(backupDir, "monthly");
  mkdirSync(dailyDir, { recursive: true });
  mkdirSync(monthlyDir, { recursive: true });

  const today = isoDate(now);
  const dailyPath = join(dailyDir, `medi-journal-${today}.sqlite.gz`);
  let dailyCreated = false;
  if (!existsSync(dailyPath)) {
    await writeGzippedBackup(db, dailyPath);
    dailyCreated = true;
  }

  const month = yearMonth(now);
  const monthlyPath = join(monthlyDir, `medi-journal-${month}.sqlite.gz`);
  let monthlyCreated = false;
  if (!existsSync(monthlyPath)) {
    await writeGzippedBackup(db, monthlyPath);
    monthlyCreated = true;
  }

  const dailyCutoff = new Date(now);
  dailyCutoff.setUTCDate(dailyCutoff.getUTCDate() - DAILY_RETENTION_DAYS);
  const dailyCutoffStr = isoDate(dailyCutoff);
  const prunedDaily = pruneOldFiles(dailyDir, (filename) => {
    const match = filename.match(/^medi-journal-(\d{4}-\d{2}-\d{2})\.sqlite\.gz$/);
    return !!match && match[1] < dailyCutoffStr;
  });

  const monthlyCutoff = new Date(now);
  monthlyCutoff.setUTCMonth(monthlyCutoff.getUTCMonth() - MONTHLY_RETENTION_MONTHS);
  const monthlyCutoffStr = yearMonth(monthlyCutoff);
  const prunedMonthly = pruneOldFiles(monthlyDir, (filename) => {
    const match = filename.match(/^medi-journal-(\d{4}-\d{2})\.sqlite\.gz$/);
    return !!match && match[1] < monthlyCutoffStr;
  });

  return { dailyCreated, monthlyCreated, prunedDaily, prunedMonthly };
}
