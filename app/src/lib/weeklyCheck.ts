// Spiegelt server/src/db/weeklyChecks.ts (SPEC.md §3.2).
export interface WeeklyCheck {
  week_start: string;
  asrs: number[];
  asrs_score: number;
  weight_kg: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  hr: number | null;
  effect_duration_h: number | null;
  week_rating: "deutlich_besser" | "etwas_besser" | "gleich" | "schlechter" | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  server_received_at?: string;
  sync_status: "pending" | "synced";
}

// Verbindliche Fragetexte, SPEC.md §10. Bezugsrahmen: letzte 7 Tage.
// Antwortskala 0=nie, 1=selten, 2=manchmal, 3=oft, 4=sehr oft.
export const ASRS_QUESTIONS = [
  "Letzte Details einer Aufgabe abschließen, wenn das Schwierige erledigt ist",
  "Dinge ordnen/organisieren, wenn eine Aufgabe Planung erfordert",
  "An Termine oder Verpflichtungen denken",
  "Beginn aufschieben, wenn eine Aufgabe viel Nachdenken erfordert",
  "Zappeln/Unruhe mit Händen oder Füßen bei längerem Sitzen",
  'Übermäßig aktiv und getrieben, "wie von einem Motor angetrieben"',
] as const;

export function emptyWeeklyCheck(weekStart: string): WeeklyCheck {
  return {
    week_start: weekStart,
    asrs: [0, 0, 0, 0, 0, 0],
    asrs_score: 0,
    weight_kg: null,
    bp_sys: null,
    bp_dia: null,
    hr: null,
    effect_duration_h: null,
    week_rating: null,
    notes: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    sync_status: "pending",
  };
}

// Reine UTC-Kalenderarithmetik, kein Bezug zur lokalen Zeitzone des Geräts -
// s. addDays()/shiftDay()-Bugfix in dailyEntry.ts für die Begründung, warum
// `new Date(dateString)` + lokale Methoden hier falsch wären.
export function mondayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay(); // 0=Sonntag, 1=Montag, ..., 6=Samstag
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}
