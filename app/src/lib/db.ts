import Dexie, { type EntityTable } from "dexie";
import type { DailyEntry } from "./dailyEntry";
import type { WeeklyCheck } from "./weeklyCheck";
import type { Phq9Check } from "./phq9";
import type { JournalEvent } from "./event";

interface MetaRow {
  key: string;
  value: string;
}

// Als Konstanten exportiert, damit ein Migrationstest (test/db-migration.test.ts)
// exakt dieselbe Schema-Historie nachbauen kann, ohne sie zu duplizieren und
// dadurch aus dem Tritt zu geraten.
export const V1_STORES = {
  daily_entries: "date, sync_status, updated_at",
  _meta: "key",
};

export const V2_STORES = {
  ...V1_STORES,
  weekly_checks: "week_start, sync_status, updated_at",
};

export const V3_STORES = {
  ...V2_STORES,
  phq9_checks: "date, sync_status, updated_at",
};

export const V4_STORES = {
  ...V3_STORES,
  events: "id, date, sync_status, updated_at",
};

// Primärschlüssel `date`/`week_start` (nicht Autoincrement) spiegelt SQLite
// 1:1 - sonst entstehen beim Sync Duplikate statt Upsert (SPEC.md §7 AK2).
export class MediJournalDb extends Dexie {
  daily_entries!: EntityTable<DailyEntry, "date">;
  weekly_checks!: EntityTable<WeeklyCheck, "week_start">;
  phq9_checks!: EntityTable<Phq9Check, "date">;
  events!: EntityTable<JournalEvent, "id">;
  _meta!: EntityTable<MetaRow, "key">;

  constructor(name = "medi-journal") {
    super(name);
    this.version(1).stores(V1_STORES);
    // Jeder version()-Block wiederholt alle fortbestehenden Stores explizit.
    // Geprüft (Dexie 4.4.4, node_modules/dexie/dist/dexie.js,
    // Version.prototype.stores): Dexie merged storesSource über ALLE
    // Versionen kumulativ (extend()), ein in einem späteren Block fehlender
    // Store wird NICHT gelöscht - nur ein explizites `tableName: null`
    // löscht (deleteRemovedTables prüft `newSchema[storeName] == null`
    // gegen die gemergte, nicht die pro-Version-rohe Schema-Angabe).
    // Trotzdem: vollständige Wiederholung bleibt die von Dexie empfohlene,
    // eindeutige Schreibweise (s. test/db-migration.test.ts).
    this.version(2).stores(V2_STORES);
    this.version(3).stores(V3_STORES);
    this.version(4).stores(V4_STORES);
  }
}

export const db = new MediJournalDb();

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await db._meta.get(key);
  return row?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db._meta.put({ key, value });
}
