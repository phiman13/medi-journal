import webpush from "web-push";
import type Database from "better-sqlite3";
import { deletePushSubscription, listPushSubscriptions } from "../db/pushSubscriptions";

export interface PushPayload {
  title: string;
  body: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// SPEC.md §5.5: "Erinnerung enthält keine sensiblen Inhalte" - bewusst
// derselbe Wortlaut für alle Reminder-Typen (kein "PHQ-9 fällig" o.ä. auf dem
// Sperrbildschirm, das wäre selbst schon eine sensible Info).
export const REMINDER_PAYLOAD: PushPayload = { title: "medi-journal", body: "Kurz eintragen?" };

// Als eigene Funktion statt direktem webpush.sendNotification-Aufruf im
// Scheduler injiziert (M5b-Review) - Server-Tests können so einen Fake statt
// eines echten Push-Service übergeben, ohne webpush selbst zu mocken.
export type SendFn = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
  vapid: VapidConfig,
) => Promise<void>;

export const sendViaWebPush: SendFn = async (subscription, payload, vapid) => {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  await webpush.sendNotification(subscription, JSON.stringify(payload));
};

interface WebPushError {
  statusCode?: number;
}

function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = (error as WebPushError | undefined)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

// Sendet an alle registrierten Geräte; räumt abgelaufene/widerrufene
// Subscriptions (404/410 vom Push-Service) automatisch auf. Andere Fehler
// werden geloggt, nicht geworfen - ein einzelnes fehlgeschlagenes Gerät darf
// die anderen nicht blockieren (analog runBackup().catch() in scheduler.ts).
export async function sendToAllSubscriptions(
  db: Database.Database,
  payload: PushPayload,
  vapid: VapidConfig,
  send: SendFn = sendViaWebPush,
): Promise<void> {
  const subscriptions = listPushSubscriptions(db);
  for (const subscription of subscriptions) {
    try {
      await send(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        vapid,
      );
    } catch (error) {
      if (isExpiredSubscriptionError(error)) {
        deletePushSubscription(db, subscription.endpoint);
      } else {
        console.error("Push-Versand fehlgeschlagen:", error);
      }
    }
  }
}
