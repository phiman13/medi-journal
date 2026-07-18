import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { upsertPhq9Check, InvalidScaleError } from "../src/db/phq9Checks";

function minimalCheck(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-14",
    answers: [0, 1, 0, 1, 0, 1, 0, 1, 0],
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("upsertPhq9Check", () => {
  it("berechnet score serverseitig als Summe (ignoriert einen falschen Client-Wert)", () => {
    const db = openDb(":memory:");
    const result = upsertPhq9Check(db, { ...minimalCheck(), score: 999 });
    expect(result.score).toBe(4);
  });

  it("lehnt ein answers-Array mit falscher Länge ab", () => {
    const db = openDb(":memory:");
    expect(() => upsertPhq9Check(db, minimalCheck({ answers: [0, 1, 2] }))).toThrow(
      InvalidScaleError,
    );
  });

  it("lehnt answers-Werte außerhalb 0-3 ab", () => {
    const db = openDb(":memory:");
    expect(() =>
      upsertPhq9Check(db, minimalCheck({ answers: [0, 1, 2, 3, 4, 0, 0, 0, 0] })),
    ).toThrow(InvalidScaleError);
  });

  it("Item 9 (Suizidgedanken) wird normal gespeichert, kein Sonderverhalten serverseitig", () => {
    // SPEC.md §3.3: Item-9-Verhalten ist reine UI-Anforderung (Hinweis mit
    // Krisenkontakten), der Server speichert die Antwort unverändert.
    const db = openDb(":memory:");
    const result = upsertPhq9Check(db, minimalCheck({ answers: [0, 0, 0, 0, 0, 0, 0, 0, 2] }));
    expect(result.answers[8]).toBe(2);
    expect(result.score).toBe(2);
  });
});
