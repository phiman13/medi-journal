import type { FastifyInstance } from "fastify";

// Unauthentifiziert für Uptime-Monitoring, siehe SPEC.md §4.2.
export async function healthzRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({ status: "ok" }));
}
