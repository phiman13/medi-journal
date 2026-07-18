import { describe, expect, it } from "vitest";
import { phq9Severity } from "../src/lib/phq9";

describe("phq9Severity", () => {
  it("klassifiziert die Grenzwerte aus SPEC.md §10 korrekt", () => {
    expect(phq9Severity(0)).toBe("minimal");
    expect(phq9Severity(4)).toBe("minimal");
    expect(phq9Severity(5)).toBe("mild");
    expect(phq9Severity(9)).toBe("mild");
    expect(phq9Severity(10)).toBe("moderat");
    expect(phq9Severity(14)).toBe("moderat");
    expect(phq9Severity(15)).toBe("mittelgradig schwer");
    expect(phq9Severity(19)).toBe("mittelgradig schwer");
    expect(phq9Severity(20)).toBe("schwer");
    expect(phq9Severity(27)).toBe("schwer");
  });
});
