// Gehalten synchron mit app/src/lib/reminders.ts (dort für Details/Herkunft
// der Regeln) - bewusst dupliziert statt Cross-Workspace-Import, da server/
// einen eigenen tsc-Build hat und ein Import aus app/src den Server-Build
// implizit an App-Quelldateien koppeln würde (im M5b-Review bewertet). Diese
// Kopie läuft serverseitig im Reminder-Scheduler (pushScheduler.ts), der
// unaufgefordert - ohne Client-Request - selbst wissen muss, ob "heute in
// Europe/Berlin" ein fälliger Tag ist.

const PHQ9_INTERVAL_DAYS = 14;

// Deckt sich mit app/src/lib/dailyEntry.ts#todayInBerlin() - "sv-SE"-Locale
// liefert YYYY-MM-DD direkt, DST-sicher ohne manuelle Offset-Rechnung.
export function todayInBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function nowTimeInBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function addDays(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
}

function weekdayUTC(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sonntag
}

function mondayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function mostRecentlyCompletedWeekStart(today: string): string {
  if (weekdayUTC(today) === 0) return mondayOfWeek(today);
  return mondayOfWeek(addDays(today, -7));
}

export function isWeeklyCheckDue(today: string, existingWeekStarts: string[]): boolean {
  const target = mostRecentlyCompletedWeekStart(today);
  return !existingWeekStarts.includes(target);
}

export function isPhq9Due(today: string, lastCompletedDate: string | undefined): boolean {
  if (!lastCompletedDate) return true;
  const daysSince =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastCompletedDate}T00:00:00Z`)) / 86_400_000;
  return daysSince >= PHQ9_INTERVAL_DAYS;
}
