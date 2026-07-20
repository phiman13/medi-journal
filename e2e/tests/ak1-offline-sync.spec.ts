import { test, expect } from "@playwright/test";
import { login } from "../helpers";

// SPEC.md §7, AK1: "Eintrag ... anlegen (Flugmodus an) -> App zeigt 'lokal
// gespeichert'; Flugmodus aus -> Status 'synchronisiert' ... (nach
// Sync-Poll/Push)." Ein-Geräte-Teil dieses Kriteriums (Mehrgeräte-Teil s.
// ak2-lww-conflict.spec.ts).
//
// Deckte beim Schreiben zwei echte Bugs auf (per Diagnose-Läufen mit
// Request-Logging bestätigt, s. Git-Historie):
// 1. Kein Mechanismus zog den Sync nach Wiederverbindung automatisch nach
//    (pushPending()/syncNow() existierten, wurden aber nirgends aufgerufen)
//    -> App.svelte hört jetzt auf das "online"-Browserevent.
// 2. Der erfolgreiche Hintergrund-Sync aktualisierte zwar IndexedDB, aber
//    savedStatus in den Formularen war eine einmalige Momentaufnahme ohne
//    Live-Bindung -> lib/sync.ts feuert jetzt ein SYNCED_EVENT, das alle
//    vier Formulare (Daily/Weekly/PHQ9/Event) neu einliest.
test("Eintrag offline speichern zeigt 'lokal gespeichert', online wird automatisch synchronisiert", async ({
  page,
  context,
}) => {
  await login(page);

  await context.setOffline(true);

  const focusSlider = page.getByLabel("Fokus / Ablenkbarkeit");
  await focusSlider.fill("8");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.locator(".status-zeile")).toHaveText("lokal gespeichert · synchronisiert …");

  await context.setOffline(false);

  // Kein manueller Reload/erneutes Speichern - der Sync muss von selbst
  // nachziehen, sobald die Verbindung zurück ist.
  await expect(page.locator(".status-zeile")).toHaveText("lokal gespeichert · synchronisiert ✓", {
    timeout: 10_000,
  });
});
