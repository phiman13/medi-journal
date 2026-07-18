import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/dailyEntry";

describe("addDays", () => {
  it("addiert einen Tag", () => {
    expect(addDays("2026-07-18", 1)).toBe("2026-07-19");
  });

  it("subtrahiert einen Tag", () => {
    expect(addDays("2026-07-18", -1)).toBe("2026-07-17");
  });

  it("wechselt korrekt über einen Monatswechsel", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("wechselt korrekt über einen Jahreswechsel", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
