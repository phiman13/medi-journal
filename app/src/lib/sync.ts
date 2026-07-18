import { db, getMeta, setMeta } from "./db";
import { pullSince, pushRecord } from "./api";
import type { DailyEntry } from "./dailyEntry";
import type { WeeklyCheck } from "./weeklyCheck";
import type { Phq9Check } from "./phq9";
import type { JournalEvent } from "./event";

const LAST_SYNC_CURSOR_KEY = "lastSyncCursor";

// IndexedDB (structured clone) kann keine Proxy-Objekte speichern - ein
// Svelte-5-$state-Wert schlägt sonst mit "DataCloneError" fehl, ohne dass der
// Aufrufer es merkt (der Eintrag bleibt dann unsichtbar verworfen). Aufrufer
// sollten bereits mit $state.snapshot() übergeben; das hier ist die zweite
// Absicherung, falls eine künftige Aufrufstelle das vergisst.
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

type Syncable = Record<string, unknown> & { updated_at: string; sync_status: "pending" | "synced" };

// Schmale Schnittstelle statt Dexies EntityTable<T, Key>: dessen
// InsertType/IDType-Generics lassen sich nicht sauber gegen eine geteilte
// Sync-Helper-Funktion parametrisieren, die für mehrere unterschiedlich
// typisierte Tabellen (daily_entries, weekly_checks, ...) wiederverwendet
// wird. Diese drei Methoden reichen für den gesamten Sync-Mechanismus; die
// öffentlichen Funktionen unten (saveEntry, saveWeeklyCheck, ...) sind an
// ihrer Grenze weiterhin konkret typisiert (DailyEntry/WeeklyCheck).
interface SyncableTable {
  get(key: string): Promise<Syncable | undefined>;
  put(item: Syncable): Promise<unknown>;
  where(field: string): { equals(value: string): { toArray(): Promise<Syncable[]> } };
}

// Speichern ist ein Tap: erst lokal persistieren (offline-first), danach im
// Hintergrund synchronisieren (SPEC.md §5.1). Schlägt der Push fehl (offline),
// bleibt der Eintrag `pending` und wird von pushPending() später nachgeholt.
async function saveRecord(
  table: SyncableTable,
  tableName: string,
  record: Syncable,
): Promise<void> {
  const withTimestamp: Syncable = toPlain({
    ...record,
    updated_at: new Date().toISOString(),
    sync_status: "pending",
  });
  await table.put(withTimestamp);

  try {
    const canonical = await pushRecord(tableName, withTimestamp);
    await table.put({ ...canonical, sync_status: "synced" } as Syncable);
  } catch {
    // bleibt pending, s. pushPendingForTable()
  }
}

async function pushPendingForTable(table: SyncableTable, tableName: string): Promise<void> {
  const pending = await table.where("sync_status").equals("pending").toArray();

  for (const record of pending) {
    try {
      const canonical = await pushRecord(tableName, record);
      await table.put({ ...canonical, sync_status: "synced" } as Syncable);
    } catch {
      // nächster Versuch später (z. B. beim nächsten pullChanges()-Aufruf)
    }
  }
}

// Wendet vom Server gepullte Records lokal an. Eine noch nicht gepushte
// lokale Änderung (`pending`), die neuer ist als der Server-Stand, wird NICHT
// überschrieben - sie gewinnt ohnehin beim nächsten Push (Last-Write-Wins).
async function applyPulledRecords(
  table: SyncableTable,
  keyField: string,
  records: Syncable[],
): Promise<void> {
  for (const record of records) {
    const key = record[keyField] as string;
    const local = await table.get(key);
    if (
      local &&
      local.sync_status === "pending" &&
      Date.parse(local.updated_at) > Date.parse(record.updated_at as string)
    ) {
      continue;
    }
    await table.put({ ...record, sync_status: "synced" } as Syncable);
  }
}

export function saveEntry(entry: DailyEntry): Promise<void> {
  return saveRecord(
    db.daily_entries as unknown as SyncableTable,
    "daily_entries",
    entry as unknown as Syncable,
  );
}

export function saveWeeklyCheck(check: WeeklyCheck): Promise<void> {
  return saveRecord(
    db.weekly_checks as unknown as SyncableTable,
    "weekly_checks",
    check as unknown as Syncable,
  );
}

export function savePhq9Check(check: Phq9Check): Promise<void> {
  return saveRecord(
    db.phq9_checks as unknown as SyncableTable,
    "phq9_checks",
    check as unknown as Syncable,
  );
}

export function saveEvent(event: JournalEvent): Promise<void> {
  return saveRecord(db.events as unknown as SyncableTable, "events", event as unknown as Syncable);
}

// Für Tests/gezieltes Nachziehen einzelner Entities.
export function applyPulledEntries(records: DailyEntry[]): Promise<void> {
  return applyPulledRecords(
    db.daily_entries as unknown as SyncableTable,
    "date",
    records as unknown as Syncable[],
  );
}

export async function pushPending(): Promise<void> {
  await pushPendingForTable(db.daily_entries as unknown as SyncableTable, "daily_entries");
  await pushPendingForTable(db.weekly_checks as unknown as SyncableTable, "weekly_checks");
  await pushPendingForTable(db.phq9_checks as unknown as SyncableTable, "phq9_checks");
  await pushPendingForTable(db.events as unknown as SyncableTable, "events");
}

export async function pullChanges(): Promise<void> {
  const cursor = await getMeta(LAST_SYNC_CURSOR_KEY);
  const result = await pullSince(cursor);
  await applyPulledRecords(
    db.daily_entries as unknown as SyncableTable,
    "date",
    result.daily_entries as unknown as Syncable[],
  );
  await applyPulledRecords(
    db.weekly_checks as unknown as SyncableTable,
    "week_start",
    result.weekly_checks as unknown as Syncable[],
  );
  await applyPulledRecords(
    db.phq9_checks as unknown as SyncableTable,
    "date",
    result.phq9_checks as unknown as Syncable[],
  );
  await applyPulledRecords(
    db.events as unknown as SyncableTable,
    "id",
    result.events as unknown as Syncable[],
  );
  await setMeta(LAST_SYNC_CURSOR_KEY, result.since);
}

export async function syncNow(): Promise<void> {
  await pushPending();
  await pullChanges();
}
