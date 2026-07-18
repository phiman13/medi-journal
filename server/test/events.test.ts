import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { upsertEvent, listEventsSince, InvalidEventError } from "../src/db/events";

function minimalEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    date: "2026-07-10",
    type: "dosisänderung",
    title: "Elvanse 30 → 50 mg",
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("upsertEvent", () => {
  it("legt ein neues Event an", () => {
    const db = openDb(":memory:");
    const result = upsertEvent(db, minimalEvent());
    expect(result.title).toBe("Elvanse 30 → 50 mg");
    expect(result.type).toBe("dosisänderung");
  });

  it("lehnt einen unbekannten type ab", () => {
    const db = openDb(":memory:");
    expect(() => upsertEvent(db, minimalEvent({ type: "unbekannt" }))).toThrow(InvalidEventError);
  });

  it("lehnt ein Event ohne title ab", () => {
    const db = openDb(":memory:");
    expect(() => upsertEvent(db, minimalEvent({ title: "" }))).toThrow(InvalidEventError);
  });

  it("Last-Write-Wins wie bei den anderen Tabellen", () => {
    const db = openDb(":memory:");
    upsertEvent(db, minimalEvent({ updated_at: "2026-07-10T20:00:00.000Z", title: "Zuerst" }));
    upsertEvent(
      db,
      minimalEvent({ updated_at: "2026-07-10T10:00:00.000Z", title: "Älter, verwirft nicht" }),
    );

    const [record] = listEventsSince(db, undefined);
    expect(record.title).toBe("Zuerst");
  });

  it("akzeptiert alle in SPEC.md §3.4 vorgesehenen Typen", () => {
    const db = openDb(":memory:");
    const types = [
      "dosisänderung",
      "medikament_start",
      "medikament_stopp",
      "arzttermin",
      "sonstiges",
    ];
    for (const [index, type] of types.entries()) {
      expect(() => upsertEvent(db, minimalEvent({ id: `evt-${index}`, type }))).not.toThrow();
    }
  });
});
