/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// injectManifest statt generateSW (M5b) - Workbox-Pakete werden hier als
// npm-Importe von Vite/Rollup lokal ins Bundle geschrieben, kein
// importScripts() auf ein CDN (SPEC.md §6, "keine Requests an fremde Hosts";
// nach jedem Build weiter verifiziert via `grep importScripts dist/sw.js`).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Bei generateSW war das Teil der von Workbox generierten Datei, im
// injectManifest-Modus muss es hier nachgebaut werden. self.skipWaiting()
// darf NICHT unconditional/top-level stehen - sonst würde jede neue Version
// sofort ohne Nutzerbestätigung aktiv, und der bestehende "Neue Version
// verfügbar"-Update-Flow (UpdateBanner.svelte, registerType: "prompt") wäre
// wirkungslos.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

// SPEC.md §5.5: Payload enthält bewusst keine sensiblen Inhalte (nur "Kurz
// eintragen?", s. server/src/push/sendPush.ts REMINDER_PAYLOAD).
self.addEventListener("push", (event) => {
  const data = event.data?.json() as { title?: string; body?: string } | undefined;
  const title = data?.title ?? "medi-journal";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data?.body ?? "Kurz eintragen?",
      icon: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clientsList.find((client) => "focus" in client);
      if (existing) {
        await (existing as WindowClient).focus();
        return;
      }
      await self.clients.openWindow("/");
    })(),
  );
});
