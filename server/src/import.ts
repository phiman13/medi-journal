import type { DailyEntryRecord } from "./db/dailyEntries";

// SPEC.md §5.6: Bridge-JSON (Wire, version 2) -> DB-Schema (§3.1). Deutsche
// Chip-Labels 1:1 aus legacy-bridge/elvanse-tagebuch-v2_1.html übernommen
// (Zeilen der #f-flags/#f-se/#f-se2-Checkboxen, `value`-Attribute), nicht
// erraten - sonst würden reale Exporte beim Import stillschweigend Slugs
// verlieren.
const SIDE_EFFECT_LABEL_TO_SLUG: Record<string, string> = {
  Einschlafprobleme: "einschlafprobleme",
  Appetitverlust: "appetitverlust",
  Kopfschmerzen: "kopfschmerzen",
  "Magen/Darm": "magen_darm",
  Mundtrockenheit: "mundtrockenheit",
  Schwitzen: "schwitzen",
  Herzklopfen: "herzklopfen",
  Schwindel: "schwindel",
  "Angst/Anspannung": "angst_anspannung",
  Reizbarkeit: "reizbarkeit",
  "Tics/Zucken": "tics_zucken",
  "Libido/Sexuelles": "libido_sexuell",
  Hodenschmerzen: "hodenschmerzen",
};

const FLAG_LABEL_TO_SLUG: Record<string, string> = {
  "Rausch-/High-Gefühl": "rausch_gefuehl",
  "Rebound/Crash": "rebound_crash",
};

// Bridge nutzt "stark reduziert" (Leerzeichen), DB-Enum "stark_reduziert".
const APPETITE_MAP: Record<string, string> = {
  normal: "normal",
  reduziert: "reduziert",
  "stark reduziert": "stark_reduziert",
};

const SCALE_FIELDS = [
  ["fokus", "focus"],
  ["task", "task_initiation"],
  ["ruhe", "inner_calm"],
  ["emo", "emotional_stability"],
  ["stimmung", "mood"],
  ["funktion", "day_function"],
] as const;

function toBool(value: unknown): boolean | null {
  if (value === "ja") return true;
  if (value === "nein") return false;
  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toDecimalOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export interface BridgeEntry {
  date: string;
  taken?: string;
  dose?: string | number;
  time?: string;
  wearOff?: string;
  quetiapin?: string;
  fokus?: number;
  task?: number;
  ruhe?: number;
  emo?: number;
  stimmung?: number;
  funktion?: number;
  geschafft?: string;
  sleepHours?: string | number;
  sleepQ?: string | number;
  appetit?: string;
  puls?: string | number;
  bpSys?: string | number;
  bpDia?: string | number;
  koffein?: string | number;
  alkohol?: string;
  flags?: string[];
  sideEffects?: string[];
  notizen?: string;
  updatedAt?: string;
}

export interface ImportWarning {
  date: string;
  message: string;
}

// Mappt einen Bridge-v2-Tageseintrag auf das DB-Schema. Unbekannte Chip-
// Labels werden NIE verworfen (SPEC.md §5.6), sondern nach side_effects_other
// übernommen und als Warnung gemeldet.
export function mapBridgeEntry(bridge: BridgeEntry, warnings: ImportWarning[]): DailyEntryRecord {
  const sideEffects: string[] = [];
  const otherLabels: string[] = [];

  for (const label of bridge.sideEffects ?? []) {
    const slug = SIDE_EFFECT_LABEL_TO_SLUG[label];
    if (slug) {
      sideEffects.push(slug);
    } else {
      otherLabels.push(label);
      warnings.push({
        date: bridge.date,
        message: `Unbekanntes Nebenwirkungs-Label "${label}" nach side_effects_other übernommen`,
      });
    }
  }

  const flags: string[] = [];
  for (const label of bridge.flags ?? []) {
    const slug = FLAG_LABEL_TO_SLUG[label];
    if (slug) {
      flags.push(slug);
    } else {
      otherLabels.push(label);
      warnings.push({
        date: bridge.date,
        message: `Unbekanntes Flag-Label "${label}" nach side_effects_other übernommen`,
      });
    }
  }

  const appetite = bridge.appetit ? (APPETITE_MAP[bridge.appetit] ?? null) : null;
  if (bridge.appetit && !appetite) {
    warnings.push({
      date: bridge.date,
      message: `Unbekannter Appetit-Wert "${bridge.appetit}" ignoriert`,
    });
  }

  const scaleValues: Record<string, number> = {};
  for (const [bridgeKey, dbKey] of SCALE_FIELDS) {
    const value = bridge[bridgeKey];
    if (typeof value === "number" && Number.isFinite(value)) {
      scaleValues[dbKey] = value;
    } else {
      scaleValues[dbKey] = 5;
      warnings.push({
        date: bridge.date,
        message: `Kernskala "${bridgeKey}" fehlte, auf 5 (Mitte) defaultet`,
      });
    }
  }

  return {
    date: bridge.date,
    med_taken: toBool(bridge.taken) ?? false,
    med_dose_mg: toIntOrNull(bridge.dose),
    med_time: toStringOrNull(bridge.time),
    wear_off_time: toStringOrNull(bridge.wearOff),
    quetiapine_taken: toBool(bridge.quetiapin),
    quetiapine_dose_mg: null, // Bridge kennt keine Quetiapin-Dosis, nur ja/nein
    focus: scaleValues.focus,
    task_initiation: scaleValues.task_initiation,
    inner_calm: scaleValues.inner_calm,
    emotional_stability: scaleValues.emotional_stability,
    mood: scaleValues.mood,
    day_function: scaleValues.day_function,
    accomplished: toStringOrNull(bridge.geschafft),
    sleep_hours: toDecimalOrNull(bridge.sleepHours),
    sleep_quality: toIntOrNull(bridge.sleepQ),
    appetite,
    resting_hr: toIntOrNull(bridge.puls),
    bp_sys: toIntOrNull(bridge.bpSys),
    bp_dia: toIntOrNull(bridge.bpDia),
    caffeine_units: toIntOrNull(bridge.koffein),
    alcohol: toBool(bridge.alkohol),
    side_effects: sideEffects,
    side_effects_other: otherLabels.length > 0 ? otherLabels.join(", ") : null,
    flags,
    notes: toStringOrNull(bridge.notizen),
    updated_at: bridge.updatedAt ?? new Date().toISOString(),
    deleted_at: null,
  };
}

export interface ImportEnvelope {
  app?: string;
  version?: number;
  entries?: Record<string, BridgeEntry | Record<string, unknown>>;
  weekly?: Record<string, unknown>;
  phq9?: Record<string, unknown>;
  events?: unknown[];
}

export interface ParsedImport {
  records: DailyEntryRecord[];
  warnings: ImportWarning[];
}

// version 3 (natives Schema, s. src/export.ts) kommt bereits mit den
// richtigen Feldnamen - direkter Pass-through, nur Pflichtfelder geprüft.
function passThroughNativeEntry(date: string, raw: Record<string, unknown>): DailyEntryRecord {
  return { ...raw, date } as DailyEntryRecord;
}

export function parseImportEnvelope(envelope: ImportEnvelope): ParsedImport {
  const warnings: ImportWarning[] = [];
  const records: DailyEntryRecord[] = [];

  for (const [date, entry] of Object.entries(envelope.entries ?? {})) {
    if (envelope.version === 3) {
      records.push(passThroughNativeEntry(date, entry as Record<string, unknown>));
    } else {
      records.push(mapBridgeEntry({ ...(entry as BridgeEntry), date }, warnings));
    }
  }

  // weekly_checks/phq9_checks/events haben vor M4 noch keine UI/Sync-Pfad
  // (s. docs/superpowers/specs zu M2/M3-Scope-Split) - nicht verwerfen, aber
  // auch nicht stillschweigend importieren: als Warnung melden.
  const weeklyCount = Object.keys(envelope.weekly ?? {}).length;
  const phq9Count = Object.keys(envelope.phq9 ?? {}).length;
  const eventsCount = (envelope.events ?? []).length;
  if (weeklyCount > 0) {
    warnings.push({
      date: "-",
      message: `${weeklyCount} Wochen-Check(s) im Import gefunden, Import erst ab M4 unterstützt`,
    });
  }
  if (phq9Count > 0) {
    warnings.push({
      date: "-",
      message: `${phq9Count} PHQ-9-Check(s) im Import gefunden, Import erst ab M4 unterstützt`,
    });
  }
  if (eventsCount > 0) {
    warnings.push({
      date: "-",
      message: `${eventsCount} Event(s) im Import gefunden, Import erst ab M4 unterstützt`,
    });
  }

  return { records, warnings };
}
