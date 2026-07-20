import { addDays } from "./dailyEntry";

interface Dated {
  date: string;
}

// Mittelt NUR über Einträge im Datumsfenster, die für `field` tatsächlich
// einen Wert haben (Nenner = Anzahl vorhandener Werte, nicht Kalendertage
// und nicht Anzahl Einträge im Fenster) - sowohl fehlende Tage (Lücken,
// Nachtragen laut SPEC.md §5.1) als auch vorhandene Tage mit null bei einem
// optionalen Feld (z. B. sleep_hours) würden sonst den Schnitt verfälschen:
// `5 + null` ist in JS `5`, ein null-Wert zählt also unbemerkt als 0 mit,
// wenn man nur nach Datum statt zusätzlich nach `!= null` filtert (per
// Dashboard-Test mit echten Daten gefunden, s. test/dashboardStats.test.ts).
// Fensterprüfung ist datumsbasiert (String-Vergleich auf YYYY-MM-DD), nicht
// array-index-basiert, damit Lücken keine Verschiebung verursachen.
export function averageBetween<T extends Dated>(
  entries: T[],
  field: keyof T,
  fromDate: string,
  toDate: string,
): number | null {
  const values = entries
    .filter((entry) => entry.date >= fromDate && entry.date <= toDate)
    .map((entry) => entry[field])
    .filter((value) => typeof value === "number") as number[];

  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

export interface WeekDelta {
  current: number | null;
  previous: number | null;
  delta: number | null;
}

// 7-Tage-Mittel der aktuellen Woche (today-6..today) vs. der Vorwoche
// (today-13..today-7), SPEC.md §5.3.
export function weekOverWeekDelta<T extends Dated>(
  entries: T[],
  field: keyof T,
  today: string,
): WeekDelta {
  const current = averageBetween(entries, field, addDays(today, -6), today);
  const previous = averageBetween(entries, field, addDays(today, -13), addDays(today, -7));
  const delta = current !== null && previous !== null ? current - previous : null;
  return { current, previous, delta };
}

export interface FrequencyCount {
  key: string;
  count: number;
}

// Zählt Vorkommen in einer Liste von String-Arrays (z. B. side_effects pro
// Tag), absteigend sortiert, bei Gleichstand alphabetisch stabil.
export function frequencyOfLists(lists: string[][]): FrequencyCount[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    for (const key of list) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// Zählt Vorkommen eines einzelnen kategorialen Feldes (z. B. appetite pro
// Tag), null-Werte werden ignoriert.
export function frequencyOfValues(values: (string | null)[]): FrequencyCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
