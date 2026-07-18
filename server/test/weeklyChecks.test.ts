import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import {
  upsertWeeklyCheck,
  listWeeklyChecksSince,
  InvalidScaleError,
} from "../src/db/weeklyChecks";

function minimalCheck(overrides: Record<string, unknown> = {}) {
  return {
    week_start: "2026-07-13",
    asrs: [1, 2, 1, 2, 1, 2],
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("upsertWeeklyCheck", () => {
  it("berechnet asrs_score serverseitig als Summe (ignoriert einen falschen Client-Wert)", () => {
    const db = openDb(":memory:");
    const result = upsertWeeklyCheck(db, { ...minimalCheck(), asrs_score: 999 });
    expect(result.asrs_score).toBe(1 + 2 + 1 + 2 + 1 + 2);
  });

  it("lehnt ein asrs-Array mit falscher Länge ab", () => {
    const db = openDb(":memory:");
    expect(() => upsertWeeklyCheck(db, minimalCheck({ asrs: [1, 2, 3] }))).toThrow(
      InvalidScaleError,
    );
  });

  it("lehnt asrs-Werte außerhalb 0-4 ab", () => {
    const db = openDb(":memory:");
    expect(() => upsertWeeklyCheck(db, minimalCheck({ asrs: [0, 1, 2, 3, 4, 5] }))).toThrow(
      InvalidScaleError,
    );
  });

  it("Last-Write-Wins wie bei daily_entries", () => {
    const db = openDb(":memory:");
    upsertWeeklyCheck(db, minimalCheck({ updated_at: "2026-07-13T20:00:00.000Z", weight_kg: 70 }));
    upsertWeeklyCheck(db, minimalCheck({ updated_at: "2026-07-13T10:00:00.000Z", weight_kg: 99 }));

    const [record] = listWeeklyChecksSince(db, undefined);
    expect(record.weight_kg).toBe(70);
  });
});
