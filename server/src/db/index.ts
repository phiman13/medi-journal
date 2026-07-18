import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `CREATE TABLE IF NOT EXISTS` (in schema.sql) ändert eine bereits
// existierende Tabelle nicht nach - wurde weekly_checks/phq9_checks/events
// schon vor der server_received_at/sync_seq-Erweiterung (M4a) angelegt,
// fehlen die Spalten in einer bestehenden DB-Datei bis heute (im eigenen
// lokalen Testlauf gefunden: SQLITE_ERROR "no column named
// server_received_at"). Dieser leichte Migrationsschritt holt das nach,
// ohne ein volles Migrationsframework einzuführen.
const REQUIRED_COLUMNS: Record<string, [name: string, definition: string][]> = {
  daily_entries: [
    ["server_received_at", "TEXT"],
    ["sync_seq", "INTEGER"],
  ],
  weekly_checks: [
    ["server_received_at", "TEXT"],
    ["sync_seq", "INTEGER"],
  ],
  phq9_checks: [
    ["server_received_at", "TEXT"],
    ["sync_seq", "INTEGER"],
  ],
  events: [
    ["server_received_at", "TEXT"],
    ["sync_seq", "INTEGER"],
  ],
};

function migrateMissingColumns(db: Database.Database): void {
  const tableExists = (table: string): boolean =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!tableExists(table)) continue; // wird gleich von schema.sql neu angelegt, dann bereits vollständig
    const existingColumns = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
        (column) => column.name,
      ),
    );
    for (const [name, definition] of columns) {
      if (!existingColumns.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  }
}

export function openDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrateMissingColumns(db);

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);

  return db;
}
