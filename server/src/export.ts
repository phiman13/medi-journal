import type { DailyEntryRecord } from "./db/dailyEntries";
import type { WeeklyCheckRecord } from "./db/weeklyChecks";
import type { Phq9CheckRecord } from "./db/phq9Checks";

// SPEC.md §5.6 zeigt "entries: {...Feldnamen wie §3.1...}" im Beispiel-JSON -
// das native Export-Schema nutzt also DB-Feldnamen (snake_case), NICHT die
// Bridge-v2-Feldnamen (deutsches camelCase). Damit ein späterer /import-
// Endpoint beide Formate unterscheiden kann, ist die Version hier bewusst 3
// (Bridge bleibt 2).
//
// TODO (M3d): POST /import muss sowohl version 2 (Bridge-Mapping, §5.6) als
// auch version 3 (natives Schema, direkter Upsert) lesen können, damit der
// eigene /export.json-Ausweg aus §4.4 ("alles in eine Datei") reimportierbar
// bleibt.
export const EXPORT_VERSION = 3;

export interface ExportEnvelope {
  app: string;
  version: number;
  exported: string;
  entries: Record<string, Record<string, unknown>>;
  weekly: Record<string, unknown>;
  phq9: Record<string, unknown>;
  events: unknown[];
  settings: Record<string, unknown>;
}

function stripSyncFields(record: Record<string, unknown>): Record<string, unknown> {
  const { server_received_at: _serverReceivedAt, ...rest } = record;
  return rest;
}

function toMap<T extends Record<string, unknown>>(
  records: T[],
  keyField: string,
): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {};
  for (const record of records) {
    map[record[keyField] as string] = stripSyncFields(record);
  }
  return map;
}

export function buildExportEnvelope(
  entries: DailyEntryRecord[],
  weekly: WeeklyCheckRecord[] = [],
  phq9: Phq9CheckRecord[] = [],
  now = new Date(),
): ExportEnvelope {
  return {
    app: "medi-journal",
    version: EXPORT_VERSION,
    exported: now.toISOString(),
    entries: toMap(entries, "date"),
    weekly: toMap(weekly, "week_start"),
    phq9: toMap(phq9, "date"),
    // events folgt erst mit M4d (Events+Chart-Marker).
    events: [],
    settings: {},
  };
}

const CSV_COLUMNS: { key: string; header: string }[] = [
  { key: "date", header: "Datum" },
  { key: "med_taken", header: "Elvanse eingenommen" },
  { key: "med_dose_mg", header: "Dosis (mg)" },
  { key: "med_time", header: "Einnahmezeit" },
  { key: "wear_off_time", header: "Wirkung ließ nach" },
  { key: "quetiapine_taken", header: "Quetiapin eingenommen" },
  { key: "quetiapine_dose_mg", header: "Quetiapin-Dosis (mg)" },
  { key: "focus", header: "Fokus" },
  { key: "task_initiation", header: "Ins Tun kommen" },
  { key: "inner_calm", header: "Innere Ruhe" },
  { key: "emotional_stability", header: "Emotionale Ausgeglichenheit" },
  { key: "mood", header: "Stimmung" },
  { key: "day_function", header: "Tagesfunktion" },
  { key: "accomplished", header: "Was geschafft" },
  { key: "sleep_hours", header: "Schlaf Stunden (letzte Nacht)" },
  { key: "sleep_quality", header: "Schlafqualität (letzte Nacht)" },
  { key: "appetite", header: "Appetit" },
  { key: "resting_hr", header: "Ruhepuls" },
  { key: "bp_sys", header: "Blutdruck systolisch" },
  { key: "bp_dia", header: "Blutdruck diastolisch" },
  { key: "caffeine_units", header: "Koffeinportionen" },
  { key: "alcohol", header: "Alkohol" },
  { key: "side_effects", header: "Nebenwirkungen" },
  { key: "side_effects_other", header: "Nebenwirkungen sonstige" },
  { key: "flags", header: "Flags" },
  { key: "notes", header: "Notizen" },
];

function csvField(raw: unknown): string {
  let value: string;
  if (raw === null || raw === undefined) {
    value = "";
  } else if (typeof raw === "boolean") {
    value = raw ? "ja" : "nein";
  } else if (Array.isArray(raw)) {
    // Komma statt Semikolon innerhalb des Feldes - kollidiert sonst mit dem
    // CSV-Spaltentrenner ";".
    value = raw.join(",");
  } else {
    value = String(raw);
  }

  // RFC 4180: quoten bei Trenner/Anführungszeichen/Zeilenumbruch im Feld,
  // enthaltene " verdoppeln. Ohne das brechen Freitextfelder (notes,
  // accomplished, side_effects_other) die Spaltenstruktur.
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(entries: DailyEntryRecord[]): string {
  const header = CSV_COLUMNS.map((column) => column.header).join(";");
  const rows = entries.map((entry) =>
    CSV_COLUMNS.map((column) => csvField((entry as Record<string, unknown>)[column.key])).join(";"),
  );
  const BOM = String.fromCharCode(0xfeff); // UTF-8-BOM, von Excel für korrekte Umlaut-Darstellung erwartet (SPEC.md §5.6)
  return BOM + [header, ...rows].join("\r\n");
}
