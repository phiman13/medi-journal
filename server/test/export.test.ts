import { describe, expect, it } from "vitest";
import { buildExportEnvelope, toCsv, EXPORT_VERSION } from "../src/export";
import type { DailyEntryRecord } from "../src/db/dailyEntries";

function entry(overrides: Partial<DailyEntryRecord> = {}): DailyEntryRecord {
  return {
    date: "2026-07-18",
    med_taken: true,
    med_dose_mg: 50,
    med_time: "08:00",
    wear_off_time: null,
    quetiapine_taken: false,
    quetiapine_dose_mg: null,
    focus: 7,
    task_initiation: 6,
    inner_calm: 6,
    emotional_stability: 6,
    mood: 7,
    day_function: 7,
    accomplished: null,
    sleep_hours: 7.5,
    sleep_quality: 6,
    appetite: "normal",
    resting_hr: 60,
    bp_sys: null,
    bp_dia: null,
    caffeine_units: 1,
    alcohol: false,
    side_effects: [],
    side_effects_other: null,
    flags: [],
    notes: null,
    updated_at: "2026-07-18T20:00:00.000Z",
    deleted_at: null,
    server_received_at: "2026-07-18T20:00:01.000Z",
    ...overrides,
  };
}

describe("buildExportEnvelope", () => {
  it("nutzt version 3 (natives Schema) und Feldnamen wie §3.1", () => {
    const envelope = buildExportEnvelope([entry()], new Date("2026-07-18T21:00:00.000Z"));

    expect(envelope.app).toBe("medi-journal");
    expect(envelope.version).toBe(EXPORT_VERSION);
    expect(envelope.version).toBe(3);
    expect(envelope.entries["2026-07-18"].focus).toBe(7);
    expect(envelope.entries["2026-07-18"].med_dose_mg).toBe(50);
  });

  it("entfernt interne Sync-Felder aus dem Export", () => {
    const envelope = buildExportEnvelope([entry()]);
    expect(envelope.entries["2026-07-18"]).not.toHaveProperty("server_received_at");
  });

  it("weekly/phq9/events sind vor M4 leer, aber vorhanden", () => {
    const envelope = buildExportEnvelope([]);
    expect(envelope.weekly).toEqual({});
    expect(envelope.phq9).toEqual({});
    expect(envelope.events).toEqual([]);
  });
});

describe("toCsv", () => {
  it("beginnt mit UTF-8-BOM und deutschen Spaltenköpfen, `;`-getrennt", () => {
    const csv = toCsv([entry()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const firstLine = csv.slice(1).split("\r\n")[0];
    expect(firstLine).toContain("Datum;Elvanse eingenommen;Dosis (mg)");
  });

  it("formatiert Booleans als ja/nein", () => {
    const csv = toCsv([entry({ med_taken: true, alcohol: false })]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain(";ja;");
    expect(row).toContain(";nein");
  });

  it("quotet Freitext mit Semikolon, Anführungszeichen oder Zeilenumbruch (RFC 4180)", () => {
    const csv = toCsv([entry({ notes: 'Text mit ; und "Anführung" und\nZeilenumbruch' })]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Text mit ; und ""Anführung"" und\nZeilenumbruch"');
  });

  it("verbindet Array-Felder mit Komma statt Semikolon (kein Kollisionsrisiko mit dem Spaltentrenner)", () => {
    const csv = toCsv([entry({ side_effects: ["kopfschmerzen", "reizbarkeit"] })]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain("kopfschmerzen,reizbarkeit");
  });

  it("lässt unkritische Werte unquotiert", () => {
    const csv = toCsv([entry({ notes: "Ganz normaler Text" })]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain(";Ganz normaler Text");
    expect(row).not.toContain('"Ganz normaler Text"');
  });
});
