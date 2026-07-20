import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";
import { upsertDailyEntry } from "../src/db/dailyEntries";

async function authedApp() {
  const db = openDb(":memory:");
  upsertDailyEntry(db, {
    date: "2026-07-18",
    med_taken: true,
    focus: 7,
    task_initiation: 6,
    inner_calm: 6,
    emotional_stability: 6,
    mood: 7,
    day_function: 7,
    updated_at: new Date().toISOString(),
  });

  const app = await buildApp({
    db,
    masterPasswordHash: await hashPassword("test-only"),
    sessionSecret: "test-secret-test-secret-test-secret",
    staticDir: "/nonexistent-static-dir-for-tests",
    vapid: {
      publicKey: "test-public-key",
      privateKey: "test-private-key",
      subject: "mailto:test@example.com",
    },
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { password: "test-only" },
  });
  const cookie = login.cookies[0];

  return { app, cookieHeader: `${cookie.name}=${cookie.value}` };
}

describe("GET /api/v1/export.json", () => {
  it("verlangt Authentifizierung", async () => {
    const { app } = await authedApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/export.json" });
    expect(response.statusCode).toBe(401);
  });

  it("liefert den Vollexport mit vorhandenen Einträgen", async () => {
    const { app, cookieHeader } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/export.json",
      headers: { cookie: cookieHeader },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().entries["2026-07-18"].focus).toBe(7);
  });
});

describe("GET /api/v1/export.csv", () => {
  it("liefert CSV mit korrektem Content-Type", async () => {
    const { app, cookieHeader } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/export.csv",
      headers: { cookie: cookieHeader },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("Datum;Elvanse eingenommen");
  });
});
