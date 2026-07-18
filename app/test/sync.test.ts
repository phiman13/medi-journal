import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { emptyEntry } from "../src/lib/dailyEntry";
import { emptyWeeklyCheck } from "../src/lib/weeklyCheck";
import { emptyPhq9Check } from "../src/lib/phq9";
import { emptyEvent } from "../src/lib/event";
import * as api from "../src/lib/api";

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
  return { ...actual, pushRecord: vi.fn(), pullSince: vi.fn() };
});

beforeEach(async () => {
  await db.daily_entries.clear();
  await db.weekly_checks.clear();
  await db.phq9_checks.clear();
  await db.events.clear();
  await db._meta.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("saveEntry", () => {
  it("persistiert lokal sofort und markiert als synced nach erfolgreichem Push", async () => {
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    vi.mocked(api.pushRecord).mockResolvedValue({ ...entry, server_received_at: "srv-1" } as never);

    await saveEntry(entry);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.sync_status).toBe("synced");
  });

  it("bleibt pending, wenn der Push fehlschlägt (offline)", async () => {
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    vi.mocked(api.pushRecord).mockRejectedValue(new Error("offline"));

    await saveEntry(entry);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.sync_status).toBe("pending");
  });

  it("speichert auch bei verschachtelten Proxy-Feldern (wie Sveltes $state) ohne DataCloneError", async () => {
    // Regression: IndexedDB kann keine Proxies klonen. Svelte 5 kapselt
    // $state-Werte TIEF in Proxies - die Objekt-Spread in saveRecord()
    // entproxied nur die oberste Ebene, ein verschachteltes Feld wie
    // `side_effects` bleibt sonst ein Proxy und lässt den lokalen
    // Schreibvorgang unbemerkt scheitern (im Formular gefunden, nicht durch
    // die bisherigen Tests, die immer mit reinen Objekten arbeiteten).
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    entry.side_effects = new Proxy(["kopfschmerzen"], {});
    vi.mocked(api.pushRecord).mockRejectedValue(new Error("offline"));

    await expect(saveEntry(entry)).resolves.toBeUndefined();

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored).toBeDefined();
    expect(stored?.sync_status).toBe("pending");
  });
});

describe("saveWeeklyCheck", () => {
  it("persistiert lokal und markiert als synced nach erfolgreichem Push (generalisierter Sync-Pfad)", async () => {
    const { saveWeeklyCheck } = await import("../src/lib/sync");
    const check = emptyWeeklyCheck("2026-07-13");
    vi.mocked(api.pushRecord).mockResolvedValue({ ...check, server_received_at: "srv-1" } as never);

    await saveWeeklyCheck(check);

    const stored = await db.weekly_checks.get("2026-07-13");
    expect(stored?.sync_status).toBe("synced");
  });
});

describe("savePhq9Check", () => {
  it("persistiert lokal und markiert als synced nach erfolgreichem Push (generalisierter Sync-Pfad)", async () => {
    const { savePhq9Check } = await import("../src/lib/sync");
    const check = emptyPhq9Check("2026-07-14");
    vi.mocked(api.pushRecord).mockResolvedValue({ ...check, server_received_at: "srv-1" } as never);

    await savePhq9Check(check);

    const stored = await db.phq9_checks.get("2026-07-14");
    expect(stored?.sync_status).toBe("synced");
  });
});

describe("saveEvent", () => {
  it("persistiert lokal und markiert als synced nach erfolgreichem Push (generalisierter Sync-Pfad)", async () => {
    const { saveEvent } = await import("../src/lib/sync");
    const event = emptyEvent("2026-07-10");
    vi.mocked(api.pushRecord).mockResolvedValue({ ...event, server_received_at: "srv-1" } as never);

    await saveEvent(event);

    const stored = await db.events.get(event.id);
    expect(stored?.sync_status).toBe("synced");
  });
});

describe("pushPending", () => {
  it("versucht alle pending Einträge aller vier Tabellen erneut zu pushen", async () => {
    const { pushPending } = await import("../src/lib/sync");
    const entry = { ...emptyEntry("2026-07-17"), sync_status: "pending" as const };
    const check = { ...emptyWeeklyCheck("2026-07-13"), sync_status: "pending" as const };
    const phq9 = { ...emptyPhq9Check("2026-07-14"), sync_status: "pending" as const };
    const event = { ...emptyEvent("2026-07-10"), sync_status: "pending" as const };
    await db.daily_entries.put(entry);
    await db.weekly_checks.put(check);
    await db.phq9_checks.put(phq9);
    await db.events.put(event);
    vi.mocked(api.pushRecord).mockImplementation(async (_table, record) => ({
      ...record,
      server_received_at: "srv-1",
    }));

    await pushPending();

    expect((await db.daily_entries.get("2026-07-17"))?.sync_status).toBe("synced");
    expect((await db.weekly_checks.get("2026-07-13"))?.sync_status).toBe("synced");
    expect((await db.phq9_checks.get("2026-07-14"))?.sync_status).toBe("synced");
    expect((await db.events.get(event.id))?.sync_status).toBe("synced");
  });
});

describe("applyPulledEntries", () => {
  it("übernimmt einen Server-Record, wenn lokal nichts Neueres wartet", async () => {
    const { applyPulledEntries } = await import("../src/lib/sync");
    const serverRecord = {
      ...emptyEntry("2026-07-17"),
      mood: 9,
      updated_at: "2026-07-17T20:00:00.000Z",
    };

    await applyPulledEntries([serverRecord]);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.mood).toBe(9);
    expect(stored?.sync_status).toBe("synced");
  });

  it("schützt einen neueren, noch nicht gepushten lokalen Eintrag vor Überschreiben", async () => {
    const { applyPulledEntries } = await import("../src/lib/sync");
    const localNewer = {
      ...emptyEntry("2026-07-17"),
      mood: 3,
      updated_at: "2026-07-17T22:00:00.000Z",
      sync_status: "pending" as const,
    };
    await db.daily_entries.put(localNewer);

    const olderServerRecord = {
      ...emptyEntry("2026-07-17"),
      mood: 9,
      updated_at: "2026-07-17T20:00:00.000Z",
    };
    await applyPulledEntries([olderServerRecord]);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.mood).toBe(3);
    expect(stored?.sync_status).toBe("pending");
  });
});

describe("pullChanges", () => {
  it("wendet Records aus ALLEN vier Tabellen aus einer Antwort an (generalisierter Pull)", async () => {
    const { pullChanges } = await import("../src/lib/sync");
    const event = { ...emptyEvent("2026-07-10"), title: "vom Server" };
    vi.mocked(api.pullSince).mockResolvedValue({
      since: "5",
      daily_entries: [{ ...emptyEntry("2026-07-17"), mood: 8 }],
      weekly_checks: [{ ...emptyWeeklyCheck("2026-07-13"), asrs_score: 7 }],
      phq9_checks: [{ ...emptyPhq9Check("2026-07-14"), score: 5 }],
      events: [event],
    });

    await pullChanges();

    expect((await db.daily_entries.get("2026-07-17"))?.mood).toBe(8);
    expect((await db.weekly_checks.get("2026-07-13"))?.asrs_score).toBe(7);
    expect((await db.phq9_checks.get("2026-07-14"))?.score).toBe(5);
    expect((await db.events.get(event.id))?.title).toBe("vom Server");
  });
});
