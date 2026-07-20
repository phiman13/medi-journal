import type { Page } from "@playwright/test";
import { E2E_PASSWORD } from "./constants";

export async function login(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Passwort").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("navigation", { name: "Hauptnavigation" }).waitFor();
}
