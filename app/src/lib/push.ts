import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "./api";

// VAPID-Public-Key kommt vom Server als URL-safe Base64 (Standardformat von
// web-push), `PushManager.subscribe()` erwartet aber einen Uint8Array -
// reine, testbare Konvertierung ohne Browser-APIs.
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// iOS unterstützt Web Push nur für installierte (Standalone-)PWAs, nie im
// normalen Safari-Tab (SPEC.md §4.1) - `navigator.standalone` ist der
// iOS-Safari-spezifische Indikator, `display-mode: standalone` der
// Standard-Weg für alle anderen Browser/Plattformen.
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// MUSS innerhalb einer echten User-Geste aufgerufen werden (Klick-Handler),
// sonst schlägt Notification.requestPermission() auf iOS/Safari lautlos fehl.
export async function enablePushReminders(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Benachrichtigungen wurden nicht erlaubt");
  }

  const [registration, vapidPublicKey] = await Promise.all([
    navigator.serviceWorker.ready,
    fetchVapidPublicKey(),
  ]);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await subscribePush(subscription.toJSON());
  return subscription;
}

export async function disablePushReminders(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await unsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
