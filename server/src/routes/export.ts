import type { FastifyInstance } from "fastify";
import { listDailyEntriesSince } from "../db/dailyEntries";
import { listWeeklyChecksSince } from "../db/weeklyChecks";
import { listPhq9ChecksSince } from "../db/phq9Checks";
import { buildExportEnvelope, toCsv } from "../export";

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/export.json", async (_request, reply) => {
    const entries = listDailyEntriesSince(app.db, undefined);
    const weekly = listWeeklyChecksSince(app.db, undefined);
    const phq9 = listPhq9ChecksSince(app.db, undefined);
    return reply.send(buildExportEnvelope(entries, weekly, phq9));
  });

  app.get("/api/v1/export.csv", async (_request, reply) => {
    const entries = listDailyEntriesSince(app.db, undefined);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="medi-journal-export.csv"');
    return reply.send(toCsv(entries));
  });
}
