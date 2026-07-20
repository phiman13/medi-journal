import { test, expect } from "@playwright/test";
import { login } from "../helpers";

// SPEC.md §7, AK7: "CSP blockiert testweise eingefügte externe Ressourcen."
// (npm-audit-Teil von AK7 ist kein Browser-Test, s. package.json-Script
// "audit" bzw. CI-Lauf von `npm audit`.)
test("CSP blockiert ein testweise eingefügtes externes Skript", async ({ page }) => {
  await login(page);

  const cspViolation = page.waitForEvent("console", {
    predicate: (msg) => msg.type() === "error" && /content security policy/i.test(msg.text()),
    timeout: 5_000,
  });

  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "https://example.com/injected.js";
    document.body.appendChild(script);
  });

  await expect(cspViolation).resolves.toBeTruthy();
});

test("CSP-Header ist strikt gesetzt (default-src 'self', kein CDN)", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"];

  expect(csp).toBeDefined();
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toMatch(/https?:\/\/(?!localhost)/);
});
