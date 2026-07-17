# medi-journal

Private, selbstgehostete PWA zum täglichen Tracking von Wirkung und
Nebenwirkungen einer ADHS-Medikation (Elvanse/Lisdexamfetamin, begleitend
Quetiapin), mit wöchentlichen validierten Selbsteinschätzungen (ASRS-6,
PHQ-9) und arzttauglichen Auswertungen.

Vollständige Anforderungen: [`SPEC.md`](./SPEC.md).

## Struktur

- `app/` — Frontend (Vite + Svelte + TypeScript)
- `server/` — Backend-API (Fastify + better-sqlite3 + TypeScript)
- `docs/superpowers/specs/` — Design-Dokumente aus Brainstorming-Sessions
- `legacy-bridge/` — alter HTML-Prototyp, Referenz für den Datenimport
- `fixtures/` — Test-Fixtures (u. a. eine echte Bridge-Export-Datei, s. u.)

## Setup

```bash
nvm use        # Node-Version aus .nvmrc
npm install     # installiert app/ und server/ via npm workspaces
```

## Entwicklung

```bash
npm run dev:server   # Fastify-API, Standardport siehe server/.env.example
npm run dev:app       # Vite-Dev-Server, proxied /api an den Server
```

## Deployment

```bash
cp .env.example .env   # DOMAIN, MASTER_PASSWORD_HASH (npm run hash-password --workspace server -- <passwort>), SESSION_SECRET setzen
docker compose up -d --build
```

## Status

M1 (Fundament) im Aufbau. Siehe `docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md`.

**Offen:** Eine echte Export-Datei der alten HTML-Brückenlösung muss noch als
`fixtures/bridge-export.json` abgelegt werden, um den Import (SPEC.md §5.6)
gegen reale Daten zu testen (Akzeptanzkriterium 4).
