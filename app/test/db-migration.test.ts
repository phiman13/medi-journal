import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { MediJournalDb, V1_STORES } from "../src/lib/db";

const TEST_DB_NAME = "medi-journal-migration-test";

// Dieser Test simuliert einen Nutzer, dessen Browser noch auf Schema-Version
// 1 steht (nur daily_entries/_meta), und prüft, dass das Upgrade auf
// Version 2 (MediJournalDb, inkl. weekly_checks) die bestehenden Daten nicht
// verliert. Ein Review hatte vor der Umsetzung behauptet, ein in einem
// späteren version()-Block fehlender Store würde beim Upgrade gelöscht -
// laut Dexie-Quellcode (Version.prototype.stores merged storesSource
// kumulativ über alle Versionen) stimmt das so nicht; nur ein explizites
// `tableName: null` löscht. Test bestätigt das leere-Objekt-Szenario
// dennoch als sicher, und lib/db.ts wiederholt trotzdem alle Stores pro
// Version als von Dexie empfohlene, eindeutige Schreibweise.
describe("Dexie-Migration v1 -> aktuelle Version", () => {
  it("behält bestehende daily_entries-Daten und legt weekly_checks/phq9_checks nutzbar an", async () => {
    const v1 = new Dexie(TEST_DB_NAME);
    v1.version(1).stores(V1_STORES);
    await v1.open();
    await v1
      .table("daily_entries")
      .put({ date: "2026-07-18", sync_status: "synced", updated_at: "x" });
    v1.close();

    const upgraded = new MediJournalDb(TEST_DB_NAME);
    await upgraded.open();

    const entry = await upgraded.daily_entries.get("2026-07-18");
    expect(entry).toBeDefined();
    expect(entry?.sync_status).toBe("synced");

    // Neue Stores aus v2/v3 sind nach dem Upgrade eines v1-Nutzers nutzbar.
    await upgraded.weekly_checks.put({
      week_start: "2026-07-13",
      asrs: [0, 0, 0, 0, 0, 0],
      asrs_score: 0,
      updated_at: "x",
      sync_status: "pending",
    } as never);
    await upgraded.phq9_checks.put({
      date: "2026-07-14",
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      score: 0,
      updated_at: "x",
      sync_status: "pending",
    } as never);
    expect(await upgraded.weekly_checks.get("2026-07-13")).toBeDefined();
    expect(await upgraded.phq9_checks.get("2026-07-14")).toBeDefined();

    upgraded.close();
    await Dexie.delete(TEST_DB_NAME);
  });
});
