import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../src/app";
import { openDb } from "../src/db";
import { hashPassword } from "../src/auth/password";

// SPEC.md §11/§7 AK4: Der Importer muss mit einer ECHTEN Bridge-Exportdatei
// getestet werden, nicht nur mit erfundenen Beispieldaten. Die Datei enthält
// echte Gesundheitsdaten und ist bewusst nicht im Repo (s. .gitignore) -
// dieser Test überspringt sich selbst, wenn sie lokal nicht vorhanden ist.
const FIXTURE_PATH = join(__dirname, "..", "..", "fixtures", "bridge-export.json");
const hasFixture = existsSync(FIXTURE_PATH);

describe.skipIf(!hasFixture)("Import mit echter Bridge-Exportdatei (AK4)", () => {
  it("importiert alle Tageseinträge der echten Exportdatei korrekt", async () => {
    const bridgeExport = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
    const entryCount = Object.keys(bridgeExport.entries ?? {}).length;
    expect(entryCount).toBeGreaterThan(0);

    const app = await buildApp({
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

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { password: "test-only" },
    });
    const cookie = login.cookies[0];
    const cookieHeader = `${cookie.name}=${cookie.value}`;

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      headers: { cookie: cookieHeader },
      payload: bridgeExport,
    });

    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.json().importedCount).toBe(entryCount);

    const listing = await app.inject({
      method: "GET",
      url: "/api/v1/sync",
      headers: { cookie: cookieHeader },
    });
    expect(listing.json().tables.daily_entries).toHaveLength(entryCount);

    // Jeder importierte Tag muss über den Export wieder auffindbar sein und
    // gültige Werte für die 6 Pflicht-Kernskalen haben (NOT NULL in §3.1).
    for (const record of listing.json().tables.daily_entries) {
      for (const field of [
        "focus",
        "task_initiation",
        "inner_calm",
        "emotional_stability",
        "mood",
        "day_function",
      ]) {
        expect(typeof record[field]).toBe("number");
      }
    }
  });
});
