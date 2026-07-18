import type { FastifyInstance } from "fastify";
import {
  upsertDailyEntry,
  listDailyEntriesSince,
  currentSyncSeq,
  type DailyEntryRecord,
} from "../db/dailyEntries";

interface SyncPostBody {
  table: string;
  records: DailyEntryRecord[];
}

interface SyncGetQuery {
  since?: string;
}

// M2 synct nur `daily_entries` (einzige Tabelle mit UI in diesem Meilenstein,
// s. docs/superpowers/specs/2026-07-17-m2-design.md). Das Envelope-Format
// ({table, records[]}) ist bewusst schon generisch für SPEC.md §4.2 gehalten,
// damit M4 nur weitere Tabellennamen ergänzt statt den Mechanismus neu zu bauen.
const SUPPORTED_TABLES = new Set(["daily_entries"]);

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SyncGetQuery }>("/api/v1/sync", async (request, reply) => {
    const since = request.query.since;
    const records = listDailyEntriesSince(app.db, since);

    // `since` ist ein opaker, monoton steigender Cursor (kein Zeitstempel) -
    // s. Kommentar in server/src/db/schema.sql zum sync_seq-Feld.
    return reply.send({
      since: String(currentSyncSeq(app.db)),
      tables: { daily_entries: records },
    });
  });

  app.post<{ Body: SyncPostBody }>("/api/v1/sync", async (request, reply) => {
    const { table, records } = request.body ?? { table: "", records: [] };

    if (!SUPPORTED_TABLES.has(table)) {
      return reply.code(400).send({ error: "unsupported_table", table });
    }

    for (const record of records) {
      if (!record.date || !record.updated_at) {
        return reply.code(400).send({ error: "invalid_record", record });
      }
    }

    const canonical = records.map((record) => upsertDailyEntry(app.db, record));

    return reply.send({ tables: { daily_entries: canonical } });
  });
}
