import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import {
  upsertPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
  InvalidPushSubscriptionError,
} from "../src/db/pushSubscriptions";

function sub(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "https://push.example/abc",
    p256dh: "p256dh-key",
    auth: "auth-key",
    ...overrides,
  };
}

describe("upsertPushSubscription", () => {
  it("legt eine neue Subscription an", () => {
    const db = openDb(":memory:");
    const row = upsertPushSubscription(db, sub());
    expect(row.endpoint).toBe("https://push.example/abc");
    expect(listPushSubscriptions(db)).toHaveLength(1);
  });

  it("aktualisiert Keys bei gleichem endpoint statt eine zweite Zeile anzulegen", () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, sub());
    upsertPushSubscription(db, sub({ p256dh: "neuer-key" }));
    const rows = listPushSubscriptions(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe("neuer-key");
  });

  it("erlaubt mehrere Geräte (unterschiedliche endpoints) nebeneinander", () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, sub({ endpoint: "https://push.example/iphone" }));
    upsertPushSubscription(db, sub({ endpoint: "https://push.example/laptop" }));
    expect(listPushSubscriptions(db)).toHaveLength(2);
  });

  it("wirft InvalidPushSubscriptionError bei fehlendem endpoint/keys", () => {
    const db = openDb(":memory:");
    expect(() => upsertPushSubscription(db, sub({ endpoint: "" }))).toThrow(
      InvalidPushSubscriptionError,
    );
    expect(() => upsertPushSubscription(db, sub({ p256dh: "" }))).toThrow(
      InvalidPushSubscriptionError,
    );
    expect(() => upsertPushSubscription(db, sub({ auth: "" }))).toThrow(
      InvalidPushSubscriptionError,
    );
  });
});

describe("deletePushSubscription", () => {
  it("entfernt die passende Zeile", () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, sub());
    deletePushSubscription(db, "https://push.example/abc");
    expect(listPushSubscriptions(db)).toHaveLength(0);
  });

  it("ist ein No-Op bei unbekanntem endpoint", () => {
    const db = openDb(":memory:");
    upsertPushSubscription(db, sub());
    deletePushSubscription(db, "https://push.example/unbekannt");
    expect(listPushSubscriptions(db)).toHaveLength(1);
  });
});
