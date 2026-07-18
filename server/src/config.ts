import { join } from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./data/medi-journal.sqlite",
  // Statisches Frontend-Build (app/dist). Repo-Layout server/{src,dist} + app/dist
  // bleibt im Docker-Image erhalten, daher funktioniert der relative Pfad in
  // Dev (tsx, läuft aus server/src) und Prod (node, läuft aus server/dist) gleich.
  staticDir: process.env.STATIC_DIR ?? join(__dirname, "..", "..", "app", "dist"),
  // Backup-Cron (SPEC.md §4.4). In Docker gemountet unter /backups
  // (docker-compose.yml); lokal ein relativer Ordner.
  backupDir: process.env.BACKUP_DIR ?? "./backups",
  // Master-Passwort-Auth (SPEC.md §4.3). Hash erzeugen mit: npm run hash-password -- <passwort>
  get masterPasswordHash(): string {
    return required("MASTER_PASSWORD_HASH");
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET");
  },
};
