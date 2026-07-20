import { test, expect } from "@playwright/test";
import { login } from "../helpers";

// SPEC.md §7, AK5: "PHQ-9 mit Item 9 = 1 beantwortet -> Hinweisdialog mit
// Krisenkontakten erscheint, Antwort wird normal gespeichert." SPEC.md §3.3:
// unaufdringlich, keine Blockade des Speicherns.
test("PHQ-9 Item 9 > 0 zeigt Krisenhinweis, Speichern bleibt normal möglich", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "PHQ-9" }).click();

  await expect(page.getByText("Telefonseelsorge", { exact: false })).not.toBeVisible();

  const item9 = page.getByRole("radiogroup", {
    name: "Gedanken, besser tot zu sein oder sich Leid zuzufügen",
  });
  await item9.getByText("an einzelnen Tagen").click();

  await expect(page.getByText("Telefonseelsorge", { exact: false })).toBeVisible();
  await expect(page.getByText("0800 111 0 111", { exact: false })).toBeVisible();

  // Speichern bleibt normal möglich - keine Blockade durch den Hinweis.
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.locator(".status-zeile").last()).toHaveText(
    "lokal gespeichert · synchronisiert ✓",
  );
});
