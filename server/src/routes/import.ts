import type { FastifyInstance } from "fastify";
import { upsertDailyEntry } from "../db/dailyEntries";
import { parseImportEnvelope, type ImportEnvelope } from "../import";

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ImportEnvelope }>("/api/v1/import", async (request, reply) => {
    const envelope = request.body ?? {};

    if (!envelope.entries) {
      return reply.code(400).send({ error: "invalid_import", message: "Feld 'entries' fehlt" });
    }

    const { records, warnings } = parseImportEnvelope(envelope);

    // Gleiche Last-Write-Wins-Konfliktregel wie /api/v1/sync (SPEC.md §5.6:
    // "merge, Konfliktregel wie Sync") - ein Re-Import überschreibt lokale
    // Daten nur, wenn der importierte Stand tatsächlich neuer ist.
    const imported = records.map((record) => upsertDailyEntry(app.db, record));

    return reply.send({
      importedCount: imported.length,
      warnings,
    });
  });
}
