import { describe, expect, it } from "vitest";
import { mapBridgeEntry, parseImportEnvelope, type ImportWarning } from "../src/import";

// Vollständige Kernskalen, damit Tests, die etwas anderes prüfen, nicht durch
// die "fehlende Kernskala -> Default 5"-Warnung verrauscht werden (s. eigener
// Test dafür weiter unten).
const SCALES = { fokus: 5, task: 5, ruhe: 5, emo: 5, stimmung: 5, funktion: 5 };

describe("mapBridgeEntry", () => {
  it("mappt ja/nein-Felder korrekt auf bool", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", taken: "ja", quetiapin: "nein", alkohol: "ja" },
      warnings,
    );
    expect(record.med_taken).toBe(true);
    expect(record.quetiapine_taken).toBe(false);
    expect(record.alcohol).toBe(true);
  });

  it("konvertiert Zahlen-Strings, leere Strings werden null", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", dose: "50", puls: "", bpSys: "120", koffein: "2" },
      warnings,
    );
    expect(record.med_dose_mg).toBe(50);
    expect(record.resting_hr).toBeNull();
    expect(record.bp_sys).toBe(120);
    expect(record.caffeine_units).toBe(2);
  });

  it('mappt "stark reduziert" (Leerzeichen) auf "stark_reduziert" (Underscore)', () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", appetit: "stark reduziert", ...SCALES },
      warnings,
    );
    expect(record.appetite).toBe("stark_reduziert");
    expect(warnings).toHaveLength(0);
  });

  it("mappt bekannte deutsche Nebenwirkungs-Labels auf Slugs", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", sideEffects: ["Magen/Darm", "Einschlafprobleme"] },
      warnings,
    );
    expect(record.side_effects).toEqual(["magen_darm", "einschlafprobleme"]);
    expect(record.side_effects_other).toBeNull();
  });

  it("übernimmt unbekannte Labels nach side_effects_other statt sie zu verwerfen", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", sideEffects: ["Ganz neues Symptom"], ...SCALES },
      warnings,
    );
    expect(record.side_effects).toEqual([]);
    expect(record.side_effects_other).toBe("Ganz neues Symptom");
    expect(warnings).toHaveLength(1);
  });

  it("mappt Flag-Labels auf Slugs", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry(
      { date: "2026-07-18", flags: ["Rausch-/High-Gefühl", "Rebound/Crash"] },
      warnings,
    );
    expect(record.flags).toEqual(["rausch_gefuehl", "rebound_crash"]);
  });

  it("defaultet fehlende Kernskalen auf 5 und warnt", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry({ date: "2026-07-18" }, warnings);
    expect(record.focus).toBe(5);
    expect(warnings.some((w) => w.message.includes("fokus"))).toBe(true);
  });

  it("quetiapine_dose_mg ist immer null (Bridge kennt keine Dosis)", () => {
    const warnings: ImportWarning[] = [];
    const record = mapBridgeEntry({ date: "2026-07-18", quetiapin: "ja" }, warnings);
    expect(record.quetiapine_dose_mg).toBeNull();
  });
});

describe("parseImportEnvelope", () => {
  it("mappt version-2-Einträge über die Bridge-Regeln", () => {
    const { records } = parseImportEnvelope({
      version: 2,
      entries: { "2026-07-18": { date: "2026-07-18", taken: "ja", fokus: 8 } },
    });
    expect(records).toHaveLength(1);
    expect(records[0].focus).toBe(8);
    expect(records[0].med_taken).toBe(true);
  });

  it("lässt version-3-Einträge (natives Schema) unverändert durch", () => {
    const { records } = parseImportEnvelope({
      version: 3,
      entries: { "2026-07-18": { focus: 9, mood: 7, med_taken: true } },
    });
    expect(records[0].focus).toBe(9);
    expect(records[0].date).toBe("2026-07-18");
  });

  it("warnt bei nicht-leeren weekly/phq9/events, statt sie stillschweigend zu verwerfen", () => {
    const { warnings } = parseImportEnvelope({
      version: 2,
      entries: {},
      weekly: { "2026-07-13": {} },
      phq9: { "2026-07-14": {} },
      events: [{ id: "1" }],
    });
    expect(warnings.some((w) => w.message.includes("Wochen-Check"))).toBe(true);
    expect(warnings.some((w) => w.message.includes("PHQ-9"))).toBe(true);
    expect(warnings.some((w) => w.message.includes("Event"))).toBe(true);
  });
});
