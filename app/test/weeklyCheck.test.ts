import { describe, expect, it } from "vitest";
import { mondayOfWeek } from "../src/lib/weeklyCheck";

describe("mondayOfWeek", () => {
  it("liefert denselben Tag, wenn er bereits ein Montag ist", () => {
    expect(mondayOfWeek("2026-07-13")).toBe("2026-07-13"); // Montag
  });

  it("rechnet einen Sonntag korrekt auf den Montag DAVOR zurück", () => {
    expect(mondayOfWeek("2026-07-19")).toBe("2026-07-13"); // Sonntag derselben Woche
  });

  it("rechnet einen Mittwoch auf den Montag derselben Woche zurück", () => {
    expect(mondayOfWeek("2026-07-15")).toBe("2026-07-13");
  });

  it("funktioniert über einen Monatswechsel hinweg", () => {
    expect(mondayOfWeek("2026-08-02")).toBe("2026-07-27"); // Sonntag 2.8. -> Montag 27.7.
  });

  it("funktioniert über einen Jahreswechsel hinweg", () => {
    expect(mondayOfWeek("2027-01-01")).toBe("2026-12-28"); // Freitag 1.1.2027 -> Montag 28.12.2026
  });
});
