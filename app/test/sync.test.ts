import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { emptyEntry } from "../src/lib/dailyEntry";
import * as api from "../src/lib/api";

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
  return { ...actual, pushDailyEntry: vi.fn(), pullDailyEntries: vi.fn() };
});

beforeEach(async () => {
  await db.daily_entries.clear();
  await db._meta.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("saveEntry", () => {
  it("persistiert lokal sofort und markiert als synced nach erfolgreichem Push", async () => {
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    vi.mocked(api.pushDailyEntry).mockResolvedValue({
      ...entry,
      server_received_at: "srv-1",
    } as never);

    await saveEntry(entry);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.sync_status).toBe("synced");
  });

  it("bleibt pending, wenn der Push fehlschlägt (offline)", async () => {
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    vi.mocked(api.pushDailyEntry).mockRejectedValue(new Error("offline"));

    await saveEntry(entry);

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.sync_status).toBe("pending");
  });

  it("speichert auch bei verschachtelten Proxy-Feldern (wie Sveltes $state) ohne DataCloneError", async () => {
    // Regression: IndexedDB kann keine Proxies klonen. Svelte 5 kapselt
    // $state-Werte TIEF in Proxies - die Objekt-Spread in saveEntry()
    // entproxied nur die oberste Ebene, ein verschachteltes Feld wie
    // `side_effects` bleibt sonst ein Proxy und lässt den lokalen
    // Schreibvorgang unbemerkt scheitern (im Formular gefunden, nicht durch
    // die bisherigen Tests, die immer mit reinen Objekten arbeiteten).
    const { saveEntry } = await import("../src/lib/sync");
    const entry = emptyEntry("2026-07-17");
    entry.side_effects = new Proxy(["kopfschmerzen"], {});
    vi.mocked(api.pushDailyEntry).mockRejectedValue(new Error("offline"));

    await expect(saveEntry(entry)).resolves.toBeUndefined();

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored).toBeDefined();
    expect(stored?.sync_status).toBe("pending");
  });
});

describe("pushPending", () => {
  it("versucht alle pending Einträge erneut zu pushen", async () => {
    const { pushPending } = await import("../src/lib/sync");
    const entry = { ...emptyEntry("2026-07-17"), sync_status: "pending" as const };
    await db.daily_entries.put(entry);
    vi.mocked(api.pushDailyEntry).mockResolvedValue({
      ...entry,
      server_received_at: "srv-1",
    } as never);

    await pushPending();

    const stored = await db.daily_entries.get("2026-07-17");
    expect(stored?.sync_status).toBe("synced");
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
