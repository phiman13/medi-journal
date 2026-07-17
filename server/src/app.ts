import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type Database from "better-sqlite3";
import { registerSession } from "./plugins/session";
import { healthzRoutes } from "./routes/healthz";
import { authRoutes } from "./routes/auth";

export interface AppOptions {
  db: Database.Database;
  masterPasswordHash: string;
  sessionSecret: string;
  staticDir: string;
}

const PUBLIC_PATHS = ["/healthz", "/api/v1/auth/login", "/api/v1/auth/logout"];

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  app.decorate("db", options.db);

  await registerSession(app, options.sessionSecret);

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v1") || PUBLIC_PATHS.includes(request.url)) {
      return;
    }
    if (!request.session.authenticated) {
      reply.code(401).send({ error: "unauthenticated" });
    }
  });

  await app.register(healthzRoutes);
  await app.register((instance) => authRoutes(instance, options.masterPasswordHash));

  // app/dist existiert erst nach "npm run build --workspace app". In der
  // Entwicklung läuft das Frontend über den separaten Vite-Dev-Server (Proxy
  // /api -> hierher), daher hier keine Fehlermeldung, nur stilles Überspringen.
  if (existsSync(options.staticDir)) {
    await app.register(fastifyStatic, { root: options.staticDir });
  }

  return app;
}
