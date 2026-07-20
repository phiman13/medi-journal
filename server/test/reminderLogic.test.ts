import { afterEach, describe, expect, it, vi } from "vitest";
import {
  todayInBerlin,
  nowTimeInBerlin,
  isWeeklyCheckDue,
  isPhq9Due,
  mostRecentlyCompletedWeekStart,
} from "../src/reminderLogic";

describe("todayInBerlin / nowTimeInBerlin", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("liefert YYYY-MM-DD und HH:MM in Europe/Berlin (Winterzeit, UTC+1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T23:30:00Z")); // 00:30 Berlin am 2026-01-02
    expect(todayInBerlin()).toBe("2026-01-02");
    expect(nowTimeInBerlin()).toBe("00:30");
  });

  it("liefert korrekt verschobene Zeit in Sommerzeit (UTC+2), nicht die reine UTC-Uhrzeit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T19:00:00Z")); // 21:00 Berlin (Sommerzeit)
    expect(todayInBerlin()).toBe("2026-07-01");
    expect(nowTimeInBerlin()).toBe("21:00");
  });
});

describe("mostRecentlyCompletedWeekStart / isWeeklyCheckDue", () => {
  it("ist an einem Sonntag die laufende (heutige) Woche", () => {
    // 2026-07-19 ist ein Sonntag
    expect(mostRecentlyCompletedWeekStart("2026-07-19")).toBe("2026-07-13");
  });

  it("ist an einem Werktag die Vorwoche", () => {
    // 2026-07-22 ist ein Mittwoch
    expect(mostRecentlyCompletedWeekStart("2026-07-22")).toBe("2026-07-13");
  });

  it("isWeeklyCheckDue ist true, wenn die Zielwoche fehlt", () => {
    expect(isWeeklyCheckDue("2026-07-19", ["2026-07-06"])).toBe(true);
  });

  it("isWeeklyCheckDue ist false, wenn die Zielwoche bereits erfasst ist", () => {
    expect(isWeeklyCheckDue("2026-07-19", ["2026-07-13"])).toBe(false);
  });
});

describe("isPhq9Due", () => {
  it("ist true ohne jemals abgeschlossenen Check", () => {
    expect(isPhq9Due("2026-07-19", undefined)).toBe(true);
  });

  it("ist false innerhalb von 14 Tagen", () => {
    expect(isPhq9Due("2026-07-19", "2026-07-10")).toBe(false);
  });

  it("ist true ab genau 14 Tagen", () => {
    expect(isPhq9Due("2026-07-19", "2026-07-05")).toBe(true);
  });
});
