import { describe, expect, it } from "vitest";
import { toPolylinePoints, eventMarkerPositions } from "../src/lib/chart";

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

describe("eventMarkerPositions", () => {
  const dates = ["2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13"];

  it("platziert einen Marker an derselben x-Position wie der zugehörige Kurvenpunkt", () => {
    const markers = eventMarkerPositions(
      dates,
      [{ date: "2026-07-12", title: "Dosisänderung" }],
      90,
    );
    expect(markers).toEqual([{ x: 60, title: "Dosisänderung" }]);
  });

  it("überspringt Events außerhalb des angezeigten Zeitraums, statt sie zu verzerren", () => {
    const markers = eventMarkerPositions(dates, [{ date: "2026-06-01", title: "Zu alt" }], 90);
    expect(markers).toEqual([]);
  });

  it("platziert mehrere Events korrekt", () => {
    const markers = eventMarkerPositions(
      dates,
      [
        { date: "2026-07-10", title: "Start" },
        { date: "2026-07-13", title: "Ende" },
      ],
      90,
    );
    expect(markers).toEqual([
      { x: 0, title: "Start" },
      { x: 90, title: "Ende" },
    ]);
  });
});
