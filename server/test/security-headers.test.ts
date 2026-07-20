import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

async function testApp() {
  return buildApp({
    db: openDb(":memory:"),
    masterPasswordHash: await hashPassword("test-only"),
    sessionSecret: "test-secret-test-secret-test-secret",
    staticDir: "/nonexistent-static-dir-for-tests",
    vapid: {
      publicKey: "test-public-key",
      privateKey: "test-private-key",
      subject: "mailto:test@example.com",
    },
  });
}

// SPEC.md §4.3 ("CSP strikt") + Akzeptanzkriterium 7 ("CSP blockiert
// testweise eingefügte externe Ressourcen"). Self-hosted-Architektur
// (SPEC.md §6) - jede Direktive erlaubt ausschließlich 'self', keine
// fremden Hosts.
describe("Security-Header (CSP)", () => {
  it("setzt eine strikte Content-Security-Policy ohne fremde Hosts", async () => {
    const app = await testApp();

    const response = await app.inject({ method: "GET", url: "/healthz" });
    const csp = response.headers["content-security-policy"] as string;

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Keine externen Hosts/CDNs in irgendeiner Direktive
    expect(csp).not.toMatch(/https?:\/\/(?!localhost)/);
  });

  it("setzt HSTS gemäß SPEC.md §4.3", async () => {
    const app = await testApp();
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.headers["strict-transport-security"]).toContain("max-age=31536000");
  });
});
