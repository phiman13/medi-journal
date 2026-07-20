import { test, expect } from "@playwright/test";
import { E2E_PASSWORD } from "../constants";
import { login } from "../helpers";

function daysAgo(n: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

// SPEC.md §7, AK6: "App eine Woche nicht geöffnet -> beim Öffnen Hinweis auf
// fehlende Tage + Nachtragen-Flow." Der letzte Eintrag liegt 10 Tage zurück -
// simuliert direkt über die API (kein echtes Warten).
test("nach über einer Woche Inaktivität erscheint ein Hinweis, Nachtragen per Datums-Navigation möglich", async ({
  page,
  request,
}) => {
  const apiLogin = await request.post("/api/v1/auth/login", { data: { password: E2E_PASSWORD } });
  expect(apiLogin.ok()).toBeTruthy();

  // Andere Tests in derselben Suite können - da die App bewusst Single-User
  // ist (SPEC.md §9) und alle Tests dieselbe DB teilen - bereits einen
  // "heutigen" Eintrag angelegt haben. AK6 räumt seine eigene Vorbedingung
  // ("seit mehreren Tagen kein Eintrag") deshalb explizit selbst frei, statt
  // sich auf eine leere DB / eine bestimmte Testreihenfolge zu verlassen.
  const now = new Date().toISOString();
  await request.post("/api/v1/sync", {
    data: {
      table: "daily_entries",
      records: [0, 1, 2].map((n) => ({
        date: daysAgo(n),
        med_taken: false,
        focus: 5,
        task_initiation: 5,
        inner_calm: 5,
        emotional_stability: 5,
        mood: 5,
        day_function: 5,
        updated_at: now,
        deleted_at: now,
      })),
    },
  });

  const oldDate = daysAgo(10);
  const seed = await request.post("/api/v1/sync", {
    data: {
      table: "daily_entries",
      records: [
        {
          date: oldDate,
          med_taken: true,
          focus: 6,
          task_initiation: 6,
          inner_calm: 6,
          emotional_stability: 6,
          mood: 6,
          day_function: 6,
          updated_at: new Date(`${oldDate}T20:00:00.000Z`).toISOString(),
        },
      ],
    },
  });
  expect(seed.ok()).toBeTruthy();

  // $authenticated ist reiner In-Memory-State (s. lib/auth.ts) - ein gültiges
  // Session-Cookie allein reicht nicht, es muss über das echte Login-Formular
  // gehen, damit die App den gepullten alten Eintrag überhaupt anzeigt.
  await login(page);
  await expect(page.getByText("Seit mehreren Tagen kein Eintrag.")).toBeVisible();

  // Nachtragen-Flow: über die Datums-Navigation zum fehlenden Tag zurück und
  // ausfüllen.
  await page.getByLabel("Vorheriger Tag").click();
  const dateInput = page.locator('input[type="date"]');
  const yesterday = daysAgo(1);
  await expect(dateInput).toHaveValue(yesterday);

  await page.getByLabel("Fokus / Ablenkbarkeit").fill("7");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.locator(".status-zeile")).toHaveText("lokal gespeichert · synchronisiert ✓");
});
