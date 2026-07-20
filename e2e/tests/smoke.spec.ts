import { test, expect } from "@playwright/test";
import { login } from "../helpers";

test("Login führt zur Eintrag-Ansicht", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Eintrag", level: 1 })).toBeAttached();
  await expect(page.getByText("Elvanse eingenommen")).toBeVisible();
});
