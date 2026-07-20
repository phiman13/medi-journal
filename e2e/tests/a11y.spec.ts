import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "../helpers";

// M6-A11y-Pass: automatisierter WCAG-Regressionstest über alle Screens.
// Ergänzt die manuelle Kontrastberechnung aus dem M6-Redesign (s. Git-
// Historie "M6 UI/UX-Polish") um einen dauerhaften, in CI wiederholbaren
// Check statt einer einmaligen Stichprobe.
const SCREENS = [
  { tab: "Eintrag" },
  { tab: "Wochen" },
  { tab: "PHQ-9" },
  { tab: "Ereignisse" },
  { tab: "Verlauf" },
] as const;

test("Login-Screen ist frei von WCAG-2.1-AA-Verstößen", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

for (const { tab } of SCREENS) {
  test(`Screen "${tab}" ist frei von WCAG-2.1-AA-Verstößen`, async ({ page }) => {
    await login(page);
    await page
      .getByRole("navigation", { name: "Hauptnavigation" })
      .getByRole("button", { name: tab, exact: false })
      .click();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
