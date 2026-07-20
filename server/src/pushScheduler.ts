import type Database from "better-sqlite3";
import { todayInBerlin, nowTimeInBerlin, isWeeklyCheckDue, isPhq9Due } from "./reminderLogic";
import {
  sendToAllSubscriptions,
  REMINDER_PAYLOAD,
  type VapidConfig,
  type SendFn,
} from "./push/sendPush";

const TICK_MS = 5 * 60 * 1000;

// Alle drei Reminder-Typen sind bewusst an dieselbe Abend-Uhrzeit gekoppelt
// (SPEC.md §4.1 nennt für die tägliche Erinnerung "Default 21:00"; für
// Wochen-Check/PHQ-9 keine eigene Uhrzeit - ein separater Trigger um
// Mitternacht wäre eine unangekündigte Störung. In-App zeigen die
// entsprechenden Tabs bereits sofort ein "•"-Fällig-Badge, s.
// app/src/lib/reminders.ts; der Push ist nur der Abend-Nudge fürs
// Nicht-Geöffnet-Haben.
const REMINDER_TIME = "21:00";

type ReminderType = "daily" | "weekly" | "phq9";

function dailyEntryExists(db: Database.Database, date: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM daily_entries WHERE date = ? AND deleted_at IS NULL")
    .get(date);
}

function allWeekStarts(db: Database.Database): string[] {
  return (
    db.prepare("SELECT week_start FROM weekly_checks WHERE deleted_at IS NULL").all() as {
      week_start: string;
    }[]
  ).map((row) => row.week_start);
}

function lastPhq9Date(db: Database.Database): string | undefined {
  const row = db
    .prepare("SELECT date FROM phq9_checks WHERE deleted_at IS NULL ORDER BY date DESC LIMIT 1")
    .get() as { date: string } | undefined;
  return row?.date;
}

function dueReminderTypes(db: Database.Database, today: string): ReminderType[] {
  const due: ReminderType[] = [];
  if (!dailyEntryExists(db, today)) due.push("daily");
  if (isWeeklyCheckDue(today, allWeekStarts(db))) due.push("weekly");
  if (isPhq9Due(today, lastPhq9Date(db))) due.push("phq9");
  return due;
}

// INSERT OR IGNORE zuerst, Send danach (M5b-Review): garantiert "genau
// einmal versucht" statt "genau einmal zugestellt" - bei einem Crash
// zwischen Insert und Send lieber einmal zu wenig als zu oft senden, für
// eine Low-Stakes-Erinnerung unkritisch. `changes > 0` heißt "heute für
// diesen Typ noch nicht vermerkt".
function markNewlyDue(db: Database.Database, type: ReminderType, date: string): boolean {
  const result = db
    .prepare("INSERT OR IGNORE INTO push_reminders_sent (type, date) VALUES (?, ?)")
    .run(type, date);
  return result.changes > 0;
}

export async function runReminderTick(
  db: Database.Database,
  vapid: VapidConfig,
  send?: SendFn,
): Promise<void> {
  const today = todayInBerlin();
  if (nowTimeInBerlin() < REMINDER_TIME) return;

  const due = dueReminderTypes(db, today);
  if (due.length === 0) return;

  // Mehrere gleichzeitig fällige Typen (z. B. Sonntagabend: daily + weekly)
  // dürfen nur EINE Notification auslösen, sonst wirkt es wie ein
  // Doppel-Versand-Bug statt einem Feature (M5b-Review, Punkt 1).
  const newlyDue = due.filter((type) => markNewlyDue(db, type, today));
  if (newlyDue.length === 0) return;

  await sendToAllSubscriptions(db, REMINDER_PAYLOAD, vapid, send);
}

// Kein separater Cron-Daemon (Spec-Prinzip "so wenig bewegliche Teile wie
// möglich", analog scheduler.ts) - 5-Minuten-Tick statt stündlich, da der
// 21:00-Trigger feinere Granularität braucht als der Backup-Check.
// Overlapping-Tick-Guard: bei better-sqlite3 (synchron) faktisch nie nötig,
// aber billig genug, um Race-Conditions bei einem hängenden Push-Versand
// auszuschließen (M5b-Review, Punkt 2).
export function startPushScheduler(db: Database.Database, vapid: VapidConfig): void {
  let running = false;
  const tick = (): void => {
    if (running) return;
    running = true;
    runReminderTick(db, vapid)
      .catch((error: unknown) => {
        console.error("Reminder-Push fehlgeschlagen:", error);
      })
      .finally(() => {
        running = false;
      });
  };

  tick();
  setInterval(tick, TICK_MS);
}
