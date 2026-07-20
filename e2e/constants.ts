import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Geteilte Konstanten zwischen playwright.config.ts und den Test-Specs.
// Test-Passwort/Hash nur für die isolierte E2E-Datenbank, kein echtes
// Secret (s. playwright.config.ts webServer.env).
export const E2E_PORT = 3100;

// ABSOLUTER Pfad, bewusst (nicht "./server/data/..."): `npm run dev
// --workspace server` startet den Server-Prozess mit cwd=server/, ein
// relativer Pfad "./server/data/e2e-test.sqlite" landet von dort aus
// verschachtelt unter server/server/data/... - global-setup.ts (cwd =
// Projekt-Root) würde dann eine andere, nie existierende Datei löschen und
// der Wipe liefe stillschweigend ins Leere (per AK5-Cross-Test-Pollution
// gefunden - der "leere DB"-Wipe hatte nie wirklich funktioniert).
const E2E_ROOT = dirname(fileURLToPath(import.meta.url));
export const E2E_DB_PATH = resolve(E2E_ROOT, "../server/data/e2e-test.sqlite");

export const E2E_PASSWORD = "e2e-test-pw";
