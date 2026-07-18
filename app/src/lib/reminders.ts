import { addDays } from "./dailyEntry";
import { mondayOfWeek } from "./weeklyCheck";

const PHQ9_INTERVAL_DAYS = 14;

function weekdayUTC(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sonntag
}

// SPEC.md §5.2 (F2): "Sonntags (bzw. beim ersten App-Öffnen danach) bietet
// die App den Wochen-Check an." Ist heute Sonntag, ist die laufende Woche
// bereits komplett - sonst ist die zuletzt komplett abgeschlossene Woche die
// vorherige (deckt "beim ersten Öffnen danach" ab, falls der Sonntag selbst
// verpasst wurde).
export function mostRecentlyCompletedWeekStart(today: string): string {
  if (weekdayUTC(today) === 0) return mondayOfWeek(today);
  return mondayOfWeek(addDays(today, -7));
}

export function isWeeklyCheckDue(today: string, existingWeekStarts: string[]): boolean {
  const target = mostRecentlyCompletedWeekStart(today);
  return !existingWeekStarts.includes(target);
}

// SPEC.md §5.2: "Alle 14 Tage zusätzlich PHQ-9."
export function isPhq9Due(today: string, lastCompletedDate: string | undefined): boolean {
  if (!lastCompletedDate) return true;
  const daysSince =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastCompletedDate}T00:00:00Z`)) / 86_400_000;
  return daysSince >= PHQ9_INTERVAL_DAYS;
}
