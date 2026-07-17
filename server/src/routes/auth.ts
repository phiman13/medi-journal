import type { FastifyInstance } from "fastify";
import { verifyPassword } from "../auth/password";

interface LoginBody {
  password: string;
}

// Master-Passwort-Login als erste Auth-Stufe (SPEC.md §4.3). Passkey/WebAuthn
// folgt in M5; der API-Vertrag unter /api/v1/auth bleibt dabei stabil.
export async function authRoutes(app: FastifyInstance, masterPasswordHash: string): Promise<void> {
  app.post<{ Body: LoginBody }>("/api/v1/auth/login", async (request, reply) => {
    const { password } = request.body ?? { password: "" };
    const valid = password ? await verifyPassword(masterPasswordHash, password) : false;

    if (!valid) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    request.session.authenticated = true;
    return { status: "authenticated" };
  });

  app.post("/api/v1/auth/logout", async (request) => {
    request.session.authenticated = false;
    return { status: "logged_out" };
  });
}
