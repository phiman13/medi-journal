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

describe("POST /api/v1/import", () => {
  it("verlangt Authentifizierung", async () => {
    const { app } = await authedApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      payload: { entries: {} },
    });
    expect(response.statusCode).toBe(401);
  });

  it("lehnt einen Body ohne entries ab", async () => {
    const { app, cookieHeader } = await authedApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      headers: { cookie: cookieHeader },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it("importiert einen minimalen version-2-Datensatz und ist danach über sync abrufbar", async () => {
    const { app, cookieHeader } = await authedApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      headers: { cookie: cookieHeader },
      payload: {
        app: "elvanse-tagebuch",
        version: 2,
        entries: {
          "2026-07-18": {
            date: "2026-07-18",
            taken: "ja",
            fokus: 8,
            stimmung: 7,
            notizen: "aus Import",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().importedCount).toBe(1);

    const listing = await app.inject({
      method: "GET",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
    });
    expect(listing.json().tables.daily_entries[0].notes).toBe("aus Import");
    expect(listing.json().tables.daily_entries[0].mood).toBe(7);
  });
});
