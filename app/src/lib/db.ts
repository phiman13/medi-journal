import Dexie, { type EntityTable } from "dexie";
import type { DailyEntry } from "./dailyEntry";

interface MetaRow {
  key: string;
  value: string;
}

// Primärschlüssel `date` (nicht Autoincrement) spiegelt SQLite 1:1 - sonst
// entstehen beim Sync Duplikate statt Upsert (SPEC.md §7 AK2).
export class MediJournalDb extends Dexie {
  daily_entries!: EntityTable<DailyEntry, "date">;
  _meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("medi-journal");
    this.version(1).stores({
      daily_entries: "date, sync_status, updated_at",
      _meta: "key",
    });
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
