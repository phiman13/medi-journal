import { describe, expect, it } from "vitest";
import {
  averageBetween,
  weekOverWeekDelta,
  frequencyOfLists,
  frequencyOfValues,
} from "../src/lib/dashboardStats";

describe("averageBetween", () => {
  it("mittelt nur über vorhandene Einträge im Fenster, nicht über Kalendertage", () => {
    const entries = [
      { date: "2026-07-14", focus: 8 },
      { date: "2026-07-16", focus: 4 },
      // 2026-07-15 fehlt (Lücke) - darf den Schnitt nicht mit 0 verfälschen
    ];
    expect(averageBetween(entries, "focus", "2026-07-14", "2026-07-16")).toBe(6);
  });

  it("liefert null ohne Einträge im Fenster, statt NaN", () => {
    const entries = [{ date: "2026-01-01", focus: 5 }];
    expect(averageBetween(entries, "focus", "2026-07-14", "2026-07-16")).toBeNull();
  });

  it("filtert datumsbasiert, nicht array-index-basiert", () => {
    const entries = [
      { date: "2026-07-01", focus: 1 },
      { date: "2026-07-15", focus: 9 },
    ];
    expect(averageBetween(entries, "focus", "2026-07-14", "2026-07-16")).toBe(9);
  });

  it("ignoriert Einträge, bei denen das Feld selbst null ist, statt sie als 0 zu werten", () => {
    // Regression: `5 + null` ist in JS 5 - ein Tag mit vorhandenem Eintrag,
    // aber leerem optionalem Feld (z. B. sleep_hours nicht ausgefüllt) darf
    // nicht unbemerkt als 0 in den Schnitt einfließen (live im Dashboard mit
    // echten Daten gefunden).
    const entries = [
      { date: "2026-07-14", sleep_hours: null },
      { date: "2026-07-15", sleep_hours: 8 },
      { date: "2026-07-16", sleep_hours: null },
    ];
    expect(averageBetween(entries, "sleep_hours", "2026-07-14", "2026-07-16")).toBe(8);
  });

  it("liefert null, wenn alle Einträge im Fenster das Feld nicht gesetzt haben", () => {
    const entries = [
      { date: "2026-07-14", sleep_hours: null },
      { date: "2026-07-15", sleep_hours: null },
    ];
    expect(averageBetween(entries, "sleep_hours", "2026-07-14", "2026-07-16")).toBeNull();
  });
});

describe("weekOverWeekDelta", () => {
  it("vergleicht die letzten 7 Tage (today-6..today) mit den 7 Tagen davor (today-13..today-7)", () => {
    // today = 2026-07-18: aktuelle Woche = 07-12..07-18, Vorwoche = 07-05..07-11
    const entries = [
      { date: "2026-07-06", focus: 4 }, // Vorwoche
      { date: "2026-07-10", focus: 6 }, // Vorwoche
      { date: "2026-07-18", focus: 8 }, // aktuelle Woche (today)
    ];
    const result = weekOverWeekDelta(entries, "focus", "2026-07-18");
    expect(result.current).toBe(8);
    expect(result.previous).toBe(5);
    expect(result.delta).toBe(3);
  });

  it("liefert delta null, wenn eine der beiden Wochen keine Daten hat", () => {
    const entries = [{ date: "2026-07-18", focus: 8 }];
    const result = weekOverWeekDelta(entries, "focus", "2026-07-18");
    expect(result.current).toBe(8);
    expect(result.previous).toBeNull();
    expect(result.delta).toBeNull();
  });
});

describe("frequencyOfLists", () => {
  it("zählt Vorkommen absteigend sortiert", () => {
    const result = frequencyOfLists([
      ["kopfschmerzen"],
      ["kopfschmerzen", "schwindel"],
      ["schwindel"],
    ]);
    expect(result).toEqual([
      { key: "kopfschmerzen", count: 2 },
      { key: "schwindel", count: 2 },
    ]);
  });

  it("ist bei Gleichstand alphabetisch stabil sortiert", () => {
    const result = frequencyOfLists([["schwindel"], ["kopfschmerzen"]]);
    expect(result).toEqual([
      { key: "kopfschmerzen", count: 1 },
      { key: "schwindel", count: 1 },
    ]);
  });
});

describe("frequencyOfValues", () => {
  it("ignoriert null-Werte und zählt den Rest", () => {
    const result = frequencyOfValues(["normal", null, "reduziert", "normal"]);
    expect(result).toEqual([
      { key: "normal", count: 2 },
      { key: "reduziert", count: 1 },
    ]);
  });
});
