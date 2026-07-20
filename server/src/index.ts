import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config";
import { openDb } from "./db";
import { buildApp } from "./app";
import { startBackupScheduler } from "./scheduler";
import { startPushScheduler } from "./pushScheduler";

try {
  process.loadEnvFile();
} catch {
  // .env optional (z. B. in Docker Compose, wo Env-Vars direkt gesetzt werden)
}

async function main(): Promise<void> {
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = openDb(config.dbPath);

  const vapid = {
    publicKey: config.vapidPublicKey,
    privateKey: config.vapidPrivateKey,
    subject: config.vapidSubject,
  };

  const app = await buildApp({
    db,
    masterPasswordHash: config.masterPasswordHash,
    sessionSecret: config.sessionSecret,
    staticDir: config.staticDir,
    vapid,
  });

  startBackupScheduler(db, config.backupDir);
  startPushScheduler(db, vapid);

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
