import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

async function testApp(password: string) {
  return buildApp({
    db: openDb(":memory:"),
    masterPasswordHash: await hashPassword(password),
    sessionSecret: "test-secret-test-secret-test-secret",
    staticDir: "/nonexistent-static-dir-for-tests",
    vapid: {
      publicKey: "test-public-key",
      privateKey: "test-private-key",
      subject: "mailto:test@example.com",
    },
  });
}

describe("GET /healthz", () => {
  it("antwortet unauthentifiziert mit status ok", async () => {
    const app = await testApp("test-only");

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("Auth-Guard", () => {
  it("blockiert /api/v1-Routen ohne Session", async () => {
    const app = await testApp("test-only");

    const response = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });

    expect(response.statusCode).toBe(401);
  });

  it("lässt Login mit korrektem Passwort zu", async () => {
    const app = await testApp("correct-horse");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { password: "correct-horse" },
    });

    expect(response.statusCode).toBe(200);
  });
});
