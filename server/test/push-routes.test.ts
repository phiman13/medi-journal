import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

const VAPID = {
  publicKey: "test-public-key",
  privateKey: "test-private-key",
  subject: "mailto:test@example.com",
};

async function authedApp() {
  const app = await buildApp({
    db: openDb(":memory:"),
    masterPasswordHash: await hashPassword("test-only"),
    sessionSecret: "test-secret-test-secret-test-secret",
    staticDir: "/nonexistent-static-dir-for-tests",
    vapid: VAPID,
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { password: "test-only" },
  });
  const cookie = login.cookies[0];

  return { app, cookieHeader: `${cookie.name}=${cookie.value}` };
}

describe("GET /api/v1/push/vapid-public-key", () => {
  it("liefert den konfigurierten öffentlichen VAPID-Key, nur authentifiziert", async () => {
    const { app, cookieHeader } = await authedApp();

    const unauthed = await app.inject({ method: "GET", url: "/api/v1/push/vapid-public-key" });
    expect(unauthed.statusCode).toBe(401);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/push/vapid-public-key",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicKey: "test-public-key" });
  });
});

describe("POST/DELETE /api/v1/push/subscribe", () => {
  it("legt eine Subscription an und entfernt sie wieder", async () => {
    const { app, cookieHeader } = await authedApp();

    const subscribe = await app.inject({
      method: "POST",
      url: "/api/v1/push/subscribe",
      headers: { cookie: cookieHeader },
      payload: {
        endpoint: "https://push.example/gerät-1",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      },
    });
    expect(subscribe.statusCode).toBe(200);
    expect(subscribe.json().subscription.endpoint).toBe("https://push.example/gerät-1");

    const unsubscribe = await app.inject({
      method: "DELETE",
      url: "/api/v1/push/subscribe",
      headers: { cookie: cookieHeader },
      payload: { endpoint: "https://push.example/gerät-1" },
    });
    expect(unsubscribe.statusCode).toBe(204);
  });

  it("lehnt eine Subscription ohne endpoint/keys mit 400 ab", async () => {
    const { app, cookieHeader } = await authedApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/push/subscribe",
      headers: { cookie: cookieHeader },
      payload: { endpoint: "https://push.example/gerät-1" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("lehnt Subscribe/Unsubscribe ohne Session mit 401 ab", async () => {
    const { app } = await authedApp();

    const subscribe = await app.inject({
      method: "POST",
      url: "/api/v1/push/subscribe",
      payload: { endpoint: "e", keys: { p256dh: "p", auth: "a" } },
    });
    expect(subscribe.statusCode).toBe(401);

    const unsubscribe = await app.inject({
      method: "DELETE",
      url: "/api/v1/push/subscribe",
      payload: { endpoint: "e" },
    });
    expect(unsubscribe.statusCode).toBe(401);
  });
});

describe("POST /api/v1/push/test-send", () => {
  it("antwortet 200, auch ohne registrierte Geräte", async () => {
    const { app, cookieHeader } = await authedApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/push/test-send",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
  });

  it("ist ohne Session nicht erreichbar", async () => {
    const { app } = await authedApp();
    const response = await app.inject({ method: "POST", url: "/api/v1/push/test-send" });
    expect(response.statusCode).toBe(401);
  });
});
