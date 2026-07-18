import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

async function authedApp() {
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

  return { app, cookieHeader: `${cookie.name}=${cookie.value}` };
}

function minimalEntry(date: string, updatedAt: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    med_taken: true,
    focus: 5,
    task_initiation: 5,
    inner_calm: 5,
    emotional_stability: 5,
    mood: 5,
    day_function: 5,
    updated_at: updatedAt,
    ...overrides,
  };
}

describe("POST /api/v1/sync", () => {
  it("legt einen neuen Tageseintrag an (Insert)", async () => {
    const { app, cookieHeader } = await authedApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry("2026-07-17", "2026-07-17T20:00:00.000Z")],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tables.daily_entries).toHaveLength(1);
    expect(body.tables.daily_entries[0].date).toBe("2026-07-17");
    expect(body.tables.daily_entries[0].med_taken).toBe(true);
  });

  it("überschreibt bei neuerem updated_at (Upsert, kein Duplikat)", async () => {
    const { app, cookieHeader } = await authedApp();
    const date = "2026-07-17";

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry(date, "2026-07-17T20:00:00.000Z", { mood: 3 })],
      },
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry(date, "2026-07-17T21:00:00.000Z", { mood: 8 })],
      },
    });

    const listing = await app.inject({
      method: "GET",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
    });

    expect(second.json().tables.daily_entries[0].mood).toBe(8);
    expect(listing.json().tables.daily_entries).toHaveLength(1);
    expect(listing.json().tables.daily_entries[0].mood).toBe(8);
  });

  it("verwirft ein älteres updated_at (Last-Write-Wins)", async () => {
    const { app, cookieHeader } = await authedApp();
    const date = "2026-07-17";

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry(date, "2026-07-17T21:00:00.000Z", { mood: 8 })],
      },
    });

    const older = await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry(date, "2026-07-17T10:00:00.000Z", { mood: 1 })],
      },
    });

    expect(older.json().tables.daily_entries[0].mood).toBe(8);
  });

  it("kappt eine Client-Uhr in der Zukunft auf die Server-Empfangszeit (Tiebreaker)", async () => {
    const { app, cookieHeader } = await authedApp();
    const date = "2026-07-17";

    // Gerät A hat eine kaputte Systemuhr (weit in der Zukunft).
    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [
          minimalEntry(date, "2099-01-01T00:00:00.000Z", { mood: 1, notes: "kaputte Uhr" }),
        ],
      },
    });

    // Gerät B editiert kurz danach mit korrekter Uhr - muss trotzdem gewinnen,
    // weil die effektive Zeit von A auf die Server-Empfangszeit gekappt wird.
    // updated_at bewusst relativ zu "jetzt" (nicht hartkodiert), sonst wird der
    // Test irgendwann selbst zum "Gerät mit falscher Uhr", sobald das reale
    // Datum dieses fixe Datum überholt hat.
    const correctDevice = await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry(date, new Date().toISOString(), { mood: 9, notes: "korrekte Uhr" })],
      },
    });

    expect(correctDevice.json().tables.daily_entries[0].notes).toBe("korrekte Uhr");
  });

  it("lehnt eine nicht unterstützte Tabelle ab", async () => {
    const { app, cookieHeader } = await authedApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: { table: "weekly_checks", records: [] },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /api/v1/sync", () => {
  it("liefert nur Einträge nach dem since-Zeitstempel (server_received_at)", async () => {
    const { app, cookieHeader } = await authedApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry("2026-07-15", "2026-07-15T20:00:00.000Z")],
      },
    });

    const cursor = await app.inject({
      method: "GET",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
    });
    const since = cursor.json().since;

    await app.inject({
      method: "POST",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
      payload: {
        table: "daily_entries",
        records: [minimalEntry("2026-07-16", "2026-07-16T20:00:00.000Z")],
      },
    });

    const after = await app.inject({
      method: "GET",
      url: `/api/v1/sync?since=${encodeURIComponent(since)}`,
      headers: { cookie: cookieHeader },
    });

    expect(after.json().tables.daily_entries).toHaveLength(1);
    expect(after.json().tables.daily_entries[0].date).toBe("2026-07-16");
  });
});
