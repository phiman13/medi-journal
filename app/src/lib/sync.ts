import { db, getMeta, setMeta } from "./db";
import { pullDailyEntries, pushDailyEntry } from "./api";
import type { DailyEntry } from "./dailyEntry";

const LAST_SYNC_CURSOR_KEY = "lastSyncCursor";

// Speichern ist ein Tap: erst lokal persistieren (offline-first), danach im
// Hintergrund synchronisieren (SPEC.md §5.1). Schlägt der Push fehl (offline),
// bleibt der Eintrag `pending` und wird von pushPending() später nachgeholt.
export async function saveEntry(entry: DailyEntry): Promise<void> {
  const withTimestamp: DailyEntry = {
    ...entry,
    updated_at: new Date().toISOString(),
    sync_status: "pending",
  };
  await db.daily_entries.put(withTimestamp);

  try {
    const canonical = await pushDailyEntry(withTimestamp);
    await db.daily_entries.put({ ...canonical, sync_status: "synced" } as DailyEntry);
  } catch {
    // bleibt pending, s. pushPending()
  }
}

export async function pushPending(): Promise<void> {
  const pending = await db.daily_entries.where("sync_status").equals("pending").toArray();

  for (const entry of pending) {
    try {
      const canonical = await pushDailyEntry(entry);
      await db.daily_entries.put({ ...canonical, sync_status: "synced" } as DailyEntry);
    } catch {
      // nächster Versuch später (z. B. beim nächsten pullChanges()-Aufruf)
    }
  }
}

// Wendet vom Server gepullte Records lokal an. Eine noch nicht gepushte
// lokale Änderung (`pending`), die neuer ist als der Server-Stand, wird NICHT
// überschrieben - sie gewinnt ohnehin beim nächsten Push (Last-Write-Wins).
export async function applyPulledEntries(records: DailyEntry[]): Promise<void> {
  for (const record of records) {
    const local = await db.daily_entries.get(record.date);
    if (
      local &&
      local.sync_status === "pending" &&
      Date.parse(local.updated_at) > Date.parse(record.updated_at)
    ) {
      continue;
    }
    await db.daily_entries.put({ ...record, sync_status: "synced" } as DailyEntry);
  }
}

export async function pullChanges(): Promise<void> {
  const cursor = await getMeta(LAST_SYNC_CURSOR_KEY);
  const { since, records } = await pullDailyEntries(cursor);
  await applyPulledEntries(records);
  await setMeta(LAST_SYNC_CURSOR_KEY, since);
}

export async function syncNow(): Promise<void> {
  await pushPending();
  await pullChanges();
}
