import type Database from "better-sqlite3";
import { runBackup } from "./backup";

const ONE_HOUR_MS = 60 * 60 * 1000;

// Kein separater Cron-Daemon im Container (Spec-Prinzip "so wenig bewegliche
// Teile wie möglich", SPEC.md §4) - ein stündlicher, idempotenter Check im
// bestehenden Node-Prozess reicht: runBackup() legt pro Kalendertag nur
// einmal an. Ein Fehlschlag wird geloggt statt die künftigen Ticks
// unbemerkt zu stoppen.
export function startBackupScheduler(db: Database.Database, backupDir: string): void {
  const tick = (): void => {
    runBackup(db, backupDir).catch((error: unknown) => {
      console.error("Backup fehlgeschlagen:", error);
    });
  };

  tick(); // sofort beim Start, idempotent dank runBackup()
  setInterval(tick, ONE_HOUR_MS);
}
