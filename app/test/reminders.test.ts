import { describe, expect, it } from "vitest";
import { mostRecentlyCompletedWeekStart, isWeeklyCheckDue, isPhq9Due } from "../src/lib/reminders";

describe("mostRecentlyCompletedWeekStart", () => {
  it("liefert die laufende Woche, wenn heute Sonntag ist", () => {
    expect(mostRecentlyCompletedWeekStart("2026-07-19")).toBe("2026-07-13"); // So 19.7. -> Mo 13.7.
  });

  it("liefert die VORHERIGE Woche, wenn der Sonntag dieser Woche noch nicht erreicht ist", () => {
    expect(mostRecentlyCompletedWeekStart("2026-07-15")).toBe("2026-07-06"); // Mi 15.7. -> vorherige Woche (Mo 6.7.)
  });
});

describe("isWeeklyCheckDue", () => {
  it("ist fällig, wenn für die letzte komplette Woche noch kein Check existiert", () => {
    expect(isWeeklyCheckDue("2026-07-19", [])).toBe(true);
  });

  it("ist nicht fällig, wenn der Check für die letzte komplette Woche schon existiert", () => {
    expect(isWeeklyCheckDue("2026-07-19", ["2026-07-13"])).toBe(false);
  });

  it("bleibt fällig am Montag danach, wenn der Sonntag verpasst wurde ('beim ersten Öffnen danach')", () => {
    expect(isWeeklyCheckDue("2026-07-20", [])).toBe(true); // Montag der Folgewoche
  });
});

describe("isPhq9Due", () => {
  it("ist fällig, wenn noch nie ausgefüllt", () => {
    expect(isPhq9Due("2026-07-18", undefined)).toBe(true);
  });

  it("ist nicht fällig innerhalb von 14 Tagen", () => {
    expect(isPhq9Due("2026-07-18", "2026-07-10")).toBe(false);
  });

  it("ist fällig ab genau 14 Tagen", () => {
    expect(isPhq9Due("2026-07-24", "2026-07-10")).toBe(true);
  });
});
