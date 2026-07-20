import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { upsertPushSubscription, listPushSubscriptions } from "../src/db/pushSubscriptions";
import { sendToAllSubscriptions, type SendFn } from "../src/push/sendPush";

const VAPID = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@example.com" };

describe("sendToAllSubscriptions", () => {
  it("sendet an jede registrierte Subscription mit der gegebenen Payload", async () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, { endpoint: "https://push.example/a", p256dh: "p", auth: "a" });
    upsertPushSubscription(db, { endpoint: "https://push.example/b", p256dh: "p", auth: "a" });

    const calls: string[] = [];
    const send: SendFn = async (subscription) => {
      calls.push(subscription.endpoint);
    };

    await sendToAllSubscriptions(db, { title: "t", body: "b" }, VAPID, send);
    expect(calls.sort()).toEqual(["https://push.example/a", "https://push.example/b"]);
  });

  it("räumt eine Subscription bei 410 (Gone) automatisch auf", async () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, {
      endpoint: "https://push.example/abgelaufen",
      p256dh: "p",
      auth: "a",
    });

    const send: SendFn = async () => {
      const error = new Error("Gone") as Error & { statusCode: number };
      error.statusCode = 410;
      throw error;
    };

    await sendToAllSubscriptions(db, { title: "t", body: "b" }, VAPID, send);
    expect(listPushSubscriptions(db)).toHaveLength(0);
  });

  it("räumt eine Subscription bei 404 (Not Found) automatisch auf", async () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, {
      endpoint: "https://push.example/nicht-gefunden",
      p256dh: "p",
      auth: "a",
    });

    const send: SendFn = async () => {
      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    };

    await sendToAllSubscriptions(db, { title: "t", body: "b" }, VAPID, send);
    expect(listPushSubscriptions(db)).toHaveLength(0);
  });

  it("lässt eine Subscription bei anderen Fehlern (z. B. 500) unangetastet", async () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, {
      endpoint: "https://push.example/temp-fehler",
      p256dh: "p",
      auth: "a",
    });

    const send: SendFn = async () => {
      const error = new Error("Server Error") as Error & { statusCode: number };
      error.statusCode = 500;
      throw error;
    };

    await sendToAllSubscriptions(db, { title: "t", body: "b" }, VAPID, send);
    expect(listPushSubscriptions(db)).toHaveLength(1);
  });

  it("ein fehlschlagendes Gerät blockiert nicht den Versand an die anderen", async () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, { endpoint: "https://push.example/fehler", p256dh: "p", auth: "a" });
    upsertPushSubscription(db, { endpoint: "https://push.example/ok", p256dh: "p", auth: "a" });

    const calls: string[] = [];
    const send: SendFn = async (subscription) => {
      if (subscription.endpoint.endsWith("fehler")) {
        throw new Error("kaputt");
      }
      calls.push(subscription.endpoint);
    };

    await sendToAllSubscriptions(db, { title: "t", body: "b" }, VAPID, send);
    expect(calls).toEqual(["https://push.example/ok"]);
  });
});
