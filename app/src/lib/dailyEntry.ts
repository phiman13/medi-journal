// Spiegelt server/src/db/dailyEntries.ts (SPEC.md §3.1). `sync_status` ist ein
// rein lokales Feld (nie an den Server gesendet, s. lib/api.ts#stripLocalFields).
export interface DailyEntry {
  date: string;
  med_taken: boolean;
  med_dose_mg: number | null;
  med_time: string | null;
  wear_off_time: string | null;
  quetiapine_taken: boolean | null;
  quetiapine_dose_mg: number | null;
  focus: number;
  task_initiation: number;
  inner_calm: number;
  emotional_stability: number;
  mood: number;
  day_function: number;
  accomplished: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  appetite: "normal" | "reduziert" | "stark_reduziert" | null;
  resting_hr: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  caffeine_units: number | null;
  alcohol: boolean | null;
  side_effects: string[];
  side_effects_other: string | null;
  flags: string[];
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  server_received_at?: string;
  sync_status: "pending" | "synced";
}

export const SIDE_EFFECTS = [
  "einschlafprobleme",
  "appetitverlust",
  "kopfschmerzen",
  "magen_darm",
  "mundtrockenheit",
  "schwitzen",
  "herzklopfen",
  "schwindel",
  "angst_anspannung",
  "reizbarkeit",
  "tics_zucken",
  "libido_sexuell",
  "hodenschmerzen",
] as const;

export const FLAGS = ["rausch_gefuehl", "rebound_crash"] as const;

export function emptyEntry(date: string): DailyEntry {
  return {
    date,
    med_taken: false,
    med_dose_mg: null,
    med_time: null,
    wear_off_time: null,
    quetiapine_taken: null,
    quetiapine_dose_mg: null,
    focus: 5,
    task_initiation: 5,
    inner_calm: 5,
    emotional_stability: 5,
    mood: 5,
    day_function: 5,
    accomplished: null,
    sleep_hours: null,
    sleep_quality: null,
    appetite: null,
    resting_hr: null,
    bp_sys: null,
    bp_dia: null,
    caffeine_units: null,
    alcohol: null,
    side_effects: [],
    side_effects_other: null,
    flags: [],
    notes: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    sync_status: "pending",
  };
}

export function todayInBerlin(): string {
  // Europe/Berlin ist verbindlich für den "Tag" (SPEC.md §3.1), nicht die
  // lokale Zeitzone des Geräts (die meist gleich ist, aber nicht garantiert).
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

// Reine Kalenderarithmetik in UTC, ohne über die lokale Zeitzone zu gehen:
// `new Date(dateString + "T00:00:00")` + toISOString() verliert bei
// positivem UTC-Offset (z. B. Europe/Berlin) systematisch einen Tag, weil
// lokale Mitternacht vor der UTC-Mitternacht desselben Tages liegt.
export function addDays(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
}
