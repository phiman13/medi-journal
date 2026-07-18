import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

// Regression für den im adversarial Review vor der Umsetzung gefundenen
// Bug: ein sync_seq-Zähler PRO Tabelle würde einen einzigen globalen
// "since"-Cursor unmöglich korrekt machen. Dieser Test reproduziert genau
// das Szenario: daily_entries UND weekly_checks werden verschachtelt
// geschrieben, ein einzelner since-Cursor muss beide korrekt abbilden.
describe("GET /api/v1/sync mit mehreren Tabellen", () => {
  it("verschluckt keine Tabelle beim gemeinsamen since-Cursor", async () => {
    const app = await buildApp({
      db: openDb(":memory:"),
      masterPasswordHash: await hashPassword("test-only"),
      sessionSecret: "test-secret-test-secret-test-secret",
      staticDir: "/nonexistent-static-dir-for-tests",
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { password: "test-only" },
    });
    const cookie = login.cookies[0];
    const cookieHeader = `${cookie.name}=${cookie.value}`;

    // Verschachtelt schreiben: daily_entries, dann weekly_checks, dann
    // nochmal daily_entries - simuliert reale Nutzung über mehrere Tage.
    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [
          {
            date: "2026-07-13",
            med_taken: true,
            focus: 5,
            task_initiation: 5,
            inner_calm: 5,
            emotional_stability: 5,
            mood: 5,
            day_function: 5,
            updated_at: "2026-07-13T20:00:00.000Z",
          },
        ],
      },
    });

    const cursorAfterFirst = (
      await app.inject({ method: "GET", url: "/api/v1/sync", headers: { cookie: cookieHeader } })
    ).json().since;

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "weekly_checks",
        records: [
          {
            week_start: "2026-07-13",
            asrs: [1, 1, 1, 1, 1, 1],
            updated_at: "2026-07-13T21:00:00.000Z",
          },
        ],
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [
          {
            date: "2026-07-14",
            med_taken: true,
            focus: 6,
            task_initiation: 6,
            inner_calm: 6,
            emotional_stability: 6,
            mood: 6,
            day_function: 6,
            updated_at: "2026-07-14T20:00:00.000Z",
          },
        ],
      },
    });

    // Mit dem Cursor NACH dem ersten Schreibvorgang: beide nachfolgenden
    // Änderungen (weekly_checks UND der zweite daily_entries-Eintrag)
    // müssen sichtbar sein - keine darf verschluckt werden.
    const after = await app.inject({
      method: "GET",
      url: `/api/v1/sync?since=${encodeURIComponent(cursorAfterFirst)}`,
      headers: { cookie: cookieHeader },
    });
    const body = after.json();

    expect(body.tables.weekly_checks).toHaveLength(1);
    expect(body.tables.weekly_checks[0].week_start).toBe("2026-07-13");
    expect(body.tables.daily_entries).toHaveLength(1);
    expect(body.tables.daily_entries[0].date).toBe("2026-07-14");

    // Voller Pull ohne Cursor: alle drei Records aus beiden Tabellen da.
    const full = await app.inject({
      method: "GET",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
    });
    expect(full.json().tables.daily_entries).toHaveLength(2);
    expect(full.json().tables.weekly_checks).toHaveLength(1);
  });
});
