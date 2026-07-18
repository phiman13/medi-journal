import { describe, expect, it } from "vitest";
import { toPolylinePoints } from "../src/lib/chart";

describe("toPolylinePoints", () => {
  it("liefert einen leeren String ohne Werte", () => {
    expect(toPolylinePoints([], { width: 100, height: 50, min: 1, max: 10 })).toBe("");
  });

  it("platziert einen einzelnen Wert am linken Rand", () => {
    expect(toPolylinePoints([10], { width: 100, height: 50, min: 1, max: 10 })).toBe("0.0,0.0");
  });

  it("mappt Minimum auf die untere und Maximum auf die obere Kante", () => {
    const points = toPolylinePoints([1, 10], { width: 100, height: 50, min: 1, max: 10 });
    expect(points).toBe("0.0,50.0 100.0,0.0");
  });

  it("kappt Werte außerhalb von min/max", () => {
    const points = toPolylinePoints([0, 15], { width: 100, height: 50, min: 1, max: 10 });
    expect(points).toBe("0.0,50.0 100.0,0.0");
  });
});
