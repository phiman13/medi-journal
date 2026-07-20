import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, E2E_DB_PATH } from "./e2e/constants";

// E2E-Tests für die Akzeptanzkriterien aus SPEC.md §7 (M6). Läuft gegen
// echten Server + echten Produktions-Build (nicht den Vite-Dev-Server) -
// server serviert app/dist über fastify-static, exakt wie in Produktion.
// Eigene, isolierte SQLite-Datei statt der lokalen Dev-DB.

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // Tests INNERHALB einer Datei sequenziell
  workers: 1, // ...und auch ÜBER Dateien hinweg: eine geteilte SQLite-Datei,
  // Single-User-App (SPEC.md §9) - parallele Worker würden sich gegenseitig
  // Tagesdaten überschreiben (per Cross-Test-Pollution-Fund bei AK5 bestätigt).
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build --workspace app && npm run dev --workspace server",
    url: `http://localhost:${E2E_PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(E2E_PORT),
      DB_PATH: E2E_DB_PATH,
      BACKUP_DIR: "./server/data/e2e-backups",
      // Hash zu E2E_PASSWORD aus e2e/constants.ts, erzeugt via
      // `npm run hash-password --workspace server -- e2e-test-pw`.
      MASTER_PASSWORD_HASH:
        "$argon2id$v=19$m=65536,t=3,p=4$27B58Vmd3fsEm6Mm2F6GFw$meu6BkIsDaJtTb9Behlj65LybKQSNaCPq5n6ffkAhLM",
      SESSION_SECRET: "e2e-test-session-secret-not-for-production-use",
      VAPID_PUBLIC_KEY:
        "BE00JIsupe2MJjcHa4jh_PwnuoUoLgTTDh9k-v4_XRAiNAENKJJtyJjLnq2A1nE6uOXWK_9hClK08lisptqwIo0",
      VAPID_PRIVATE_KEY: "mmDXBmtdk6jukHx48i5KEq2T7Cr-V-mNUkODX36eIs4",
      VAPID_SUBJECT: "mailto:e2e@example.com",
    },
  },
});
