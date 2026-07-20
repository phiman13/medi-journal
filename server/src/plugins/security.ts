import fastifyHelmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

// SPEC.md §4.3: "CSP strikt (default-src 'self')", Akzeptanzkriterium 7
// ("CSP blockiert testweise eingefügte externe Ressourcen"). Self-hosted-
// Architektur (SPEC.md §6, keine Requests an fremde Hosts) - jede Direktive
// erlaubt ausschließlich 'self', keine Ausnahme für ein CDN o. ä.
//
// style-src braucht 'unsafe-inline': Svelte kompiliert dynamische
// style:--variable-Bindings (s. Skala.svelte, Dashboard.svelte) zu echten
// inline style=""-Attributen zur Laufzeit - ohne das würden die Dosier-Skala
// und die Serien-Chips optisch kaputtgehen. Deutlich geringeres Risiko als
// unsafe-inline bei script-src (reiner Style-Injection-Vektor, kein XSS-Pfad
// für Skriptausführung), script-src bleibt ohne jede Ausnahme.
export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // SPEC.md §4.3 verlangt HSTS explizit; per Default in @fastify/helmet
    // aktiv - hier nur die Absicht dokumentiert, keine Sonderkonfiguration.
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });
}
