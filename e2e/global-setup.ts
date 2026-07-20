import { rmSync } from "node:fs";
import { E2E_DB_PATH } from "./constants";

// Jeder E2E-Lauf startet mit einer leeren Datenbank - sonst akkumulieren
// Testdaten über mehrere `npx playwright test`-Aufrufe hinweg (die Datei
// bleibt zwischen Läufen bestehen, nur der Server-Prozess wird neu
// gestartet) und Tests wie AK6 (setzt "kein aktueller Eintrag" voraus)
// werden nichtdeterministisch, je nachdem was vorher schon gelaufen ist.
export default function globalSetup(): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
  }
}
