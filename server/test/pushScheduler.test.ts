import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db";
import { upsertPushSubscription } from "../src/db/pushSubscriptions";
import { runReminderTick } from "../src/pushScheduler";
import type { SendFn } from "../src/push/sendPush";

const VAPID = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@example.com" };

function withSubscription(db: ReturnType<typeof openDb>): void {
  upsertPushSubscription(db, { endpoint: "https://push.example/a", p256dh: "p", auth: "a" });
}

function countingSend(): { send: SendFn; count: () => number } {
  let calls = 0;
  const send: SendFn = async () => {
    calls += 1;
  };
  return { send, count: () => calls };
}

describe("runReminderTick", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sendet nichts vor 21:00 Berlin, auch wenn ein Eintrag fällig ist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T15:00:00Z")); // 17:00 Berlin, Mittwoch
    const db = openDb(":memory:");
    withSubscription(db);
    const { send, count } = countingSend();

    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(0);
  });

  it("sendet ab 21:00 Berlin genau eine Erinnerung, wenn heute kein Eintrag existiert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T19:00:00Z")); // 21:00 Berlin
    const db = openDb(":memory:");
    withSubscription(db);
    const { send, count } = countingSend();

    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(1);
  });

  it("sendet bei einem erneuten Tick am selben Abend nicht nochmal (Idempotenz)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T19:00:00Z"));
    const db = openDb(":memory:");
    withSubscription(db);
    const { send, count } = countingSend();

    await runReminderTick(db, VAPID, send);
    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(1);
  });

  it("bündelt mehrere gleichzeitig fällige Typen zu EINER Notification", async () => {
    // 2026-07-19 ist ein Sonntag -> weekly ebenfalls fällig (keine
    // weekly_checks-Zeile), phq9 ebenfalls (kein je abgeschlossener Check) -
    // in einer leeren DB sind an diesem Tag alle drei Typen gleichzeitig
    // fällig, dürfen aber trotzdem nur EINE Notification auslösen.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T19:00:00Z")); // 21:00 Berlin, Sonntag
    const db = openDb(":memory:");
    withSubscription(db);
    const { send, count } = countingSend();

    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(1);

    const sentTypes = db.prepare("SELECT type FROM push_reminders_sent ORDER BY type").all() as {
      type: string;
    }[];
    expect(sentTypes.map((row) => row.type)).toEqual(["daily", "phq9", "weekly"]);
  });

  it("sendet erneut, wenn ein neuer Typ erst später am selben Abend fällig wird", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T19:00:00Z"));
    const db = openDb(":memory:");
    withSubscription(db);

    // Simuliert: 'daily' wurde in einem früheren Tick bereits als versendet
    // vermerkt, 'weekly' ist heute aber neu fällig geworden.
    db.prepare("INSERT INTO push_reminders_sent (type, date) VALUES ('daily', '2026-07-19')").run();

    const { send, count } = countingSend();
    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(1);
  });

  it("sendet nichts, wenn kein Typ fällig ist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T19:00:00Z")); // Mittwoch, kein weekly/phq9-Trigger
    const db = openDb(":memory:");
    withSubscription(db);
    db.prepare(
      "INSERT INTO daily_entries (date, med_taken, focus, task_initiation, inner_calm, emotional_stability, mood, day_function, updated_at, server_received_at, sync_seq) VALUES ('2026-07-22', 1, 5, 5, 5, 5, 5, 5, '2026-07-22T18:00:00.000Z', '2026-07-22T18:00:01.000Z', 1)",
    ).run();
    db.prepare(
      "INSERT INTO weekly_checks (week_start, asrs, asrs_score, updated_at, server_received_at, sync_seq) VALUES ('2026-07-13', '[1,1,1,1,1,1]', 6, '2026-07-13T18:00:00.000Z', '2026-07-13T18:00:01.000Z', 2)",
    ).run();
    db.prepare(
      "INSERT INTO phq9_checks (date, answers, score, updated_at, server_received_at, sync_seq) VALUES ('2026-07-15', '[0,0,0,0,0,0,0,0,0]', 0, '2026-07-15T18:00:00.000Z', '2026-07-15T18:00:01.000Z', 3)",
    ).run();

    const { send, count } = countingSend();
    await runReminderTick(db, VAPID, send);
    expect(count()).toBe(0);
  });
});
