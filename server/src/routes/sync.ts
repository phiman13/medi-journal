import type { FastifyInstance } from "fastify";
import { upsertDailyEntry, listDailyEntriesSince, type DailyEntryRecord } from "../db/dailyEntries";
import {
  upsertWeeklyCheck,
  listWeeklyChecksSince,
  InvalidScaleError as InvalidWeeklyScaleError,
} from "../db/weeklyChecks";
import {
  upsertPhq9Check,
  listPhq9ChecksSince,
  InvalidScaleError as InvalidPhq9ScaleError,
} from "../db/phq9Checks";
import { upsertEvent, listEventsSince, InvalidEventError, type EventRecord } from "../db/events";
import { currentGlobalSyncSeq } from "../db/syncCounter";
import type Database from "better-sqlite3";

interface SyncPostBody {
  table: string;
  records: Array<Record<string, unknown>>;
}

interface SyncGetQuery {
  since?: string;
}

const TABLE_KEY_FIELD: Record<string, string> = {
  daily_entries: "date",
  weekly_checks: "week_start",
  phq9_checks: "date",
  events: "id",
};

function upsert(
  db: Database.Database,
  table: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (table === "daily_entries") return upsertDailyEntry(db, record as DailyEntryRecord);
  if (table === "weekly_checks") return upsertWeeklyCheck(db, record as { week_start: string });
  if (table === "phq9_checks") return upsertPhq9Check(db, record as { date: string });
  return upsertEvent(db, record as EventRecord);
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SyncGetQuery }>("/api/v1/sync", async (request, reply) => {
    const since = request.query.since;

    // `since` ist ein opaker, monoton steigender, ÜBER ALLE TABELLEN geteilter
    // Cursor (kein Zeitstempel) - s. Kommentar in server/src/db/schema.sql
    // (sync_counter) dazu, warum ein Zähler pro Tabelle nicht funktioniert.
    return reply.send({
      since: String(currentGlobalSyncSeq(app.db)),
      tables: {
        daily_entries: listDailyEntriesSince(app.db, since),
        weekly_checks: listWeeklyChecksSince(app.db, since),
        phq9_checks: listPhq9ChecksSince(app.db, since),
        events: listEventsSince(app.db, since),
      },
    });
  });

  app.post<{ Body: SyncPostBody }>("/api/v1/sync", async (request, reply) => {
    const { table, records } = request.body ?? { table: "", records: [] };
    const keyField = TABLE_KEY_FIELD[table];

    if (!keyField) {
      return reply.code(400).send({ error: "unsupported_table", table });
    }

    for (const record of records) {
      if (!record[keyField] || !record.updated_at) {
        return reply.code(400).send({ error: "invalid_record", record });
      }
    }

    try {
      const canonical = records.map((record) => upsert(app.db, table, record));
      return reply.send({ tables: { [table]: canonical } });
    } catch (error) {
      if (error instanceof InvalidWeeklyScaleError || error instanceof InvalidPhq9ScaleError) {
        return reply.code(400).send({ error: "invalid_scale", message: error.message });
      }
      if (error instanceof InvalidEventError) {
        return reply.code(400).send({ error: "invalid_event", message: error.message });
      }
      throw error;
    }
  });
}
