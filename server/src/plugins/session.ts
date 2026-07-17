import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import type { FastifyInstance } from "fastify";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function registerSession(app: FastifyInstance, sessionSecret: string): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: sessionSecret,
    cookieName: "medi_journal_session",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: THIRTY_DAYS_MS,
    },
    // Rolling session: Ablauf verlängert sich bei jedem Request (SPEC.md §4.3).
    rolling: true,
  });
}

declare module "@fastify/session" {
  interface FastifySessionObject {
    authenticated?: boolean;
  }
}
