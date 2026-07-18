import type { FastifyInstance } from "fastify";
import { listDailyEntriesSince } from "../db/dailyEntries";
import { buildExportEnvelope, toCsv } from "../export";

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/export.json", async (_request, reply) => {
    const entries = listDailyEntriesSince(app.db, undefined);
    return reply.send(buildExportEnvelope(entries));
  });

  app.get("/api/v1/export.csv", async (_request, reply) => {
    const entries = listDailyEntriesSince(app.db, undefined);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="medi-journal-export.csv"');
    return reply.send(toCsv(entries));
  });
}
