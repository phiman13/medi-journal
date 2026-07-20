import { test, expect } from "@playwright/test";
import { login } from "../helpers";

// SPEC.md §7, AK2: "Denselben Tag nacheinander auf zwei Geräten editieren ->
// der spätere Stand gewinnt vollständig; kein Duplikat, kein Datenverlust
// anderer Tage." Simuliert über zwei unabhängige Browser-Contexts (= zwei
// "Geräte") gegen denselben Server.
test("Last-Write-Wins: der später gespeicherte Stand gewinnt auf beiden Geräten", async ({
  browser,
  baseURL,
}) => {
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  const pageA = await deviceA.newPage();
  const pageB = await deviceB.newPage();

  await login(pageA);
  await login(pageB);

  // Gerät A editiert zuerst und synchronisiert.
  await pageA.getByLabel("Fokus / Ablenkbarkeit").fill("3");
  await pageA.getByRole("button", { name: "Speichern" }).click();
  await expect(pageA.locator(".status-zeile")).toHaveText("lokal gespeichert · synchronisiert ✓");

  // Gerät B editiert denselben Tag danach (späterer updated_at) und
  // synchronisiert ebenfalls.
  await pageB.getByLabel("Fokus / Ablenkbarkeit").fill("9");
  await pageB.getByRole("button", { name: "Speichern" }).click();
  await expect(pageB.locator(".status-zeile")).toHaveText("lokal gespeichert · synchronisiert ✓");

  // Gerät A öffnet die App erneut (z. B. beim nächsten Öffnen) und muss den
  // späteren Stand von Gerät B übernehmen, nicht seinen eigenen behalten.
  // $authenticated ist bewusst reiner In-Memory-State (kein Server-Session-
  // Check beim Mount, s. lib/auth.ts) - ein Reload zeigt daher zunächst
  // wieder den Login-Screen, die Server-Session selbst bleibt gültig.
  await login(pageA);
  await expect(pageA.getByLabel("Fokus / Ablenkbarkeit")).toHaveValue("9");

  // Kein Duplikat: nur ein einziger Tageseintrag serverseitig für heute.
  const response = await pageA.request.get(`${baseURL}/api/v1/export.json`);
  const body = await response.json();
  const today = new Date().toISOString().slice(0, 10);
  expect(Object.keys(body.entries).filter((date) => date === today)).toHaveLength(1);
  expect(body.entries[today].focus).toBe(9);

  await deviceA.close();
  await deviceB.close();
});
