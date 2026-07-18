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
- `scripts/` — Betriebs-Skripte (Off-Site-Backup-Sync)

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

## Backup & Restore

Der Server sichert automatisch: sofort beim Start und danach stündlich
geprüft (idempotent, ein Backup pro Kalendertag), s. `server/src/backup.ts`.
Abgelegt unter `backups/` (Docker-Volume, s. `docker-compose.yml`):

- `backups/daily/medi-journal-YYYY-MM-DD.sqlite.gz` — 30 Tage Aufbewahrung
- `backups/monthly/medi-journal-YYYY-MM.sqlite.gz` — 12 Monate Aufbewahrung

**Restore:**

```bash
docker compose stop app
gunzip -c backups/daily/medi-journal-2026-07-18.sqlite.gz > /tmp/restored.sqlite
docker cp /tmp/restored.sqlite <container>:/data/medi-journal.sqlite
docker compose start app
```

Lokal (ohne Docker): `gunzip -c backups/daily/<datei>.sqlite.gz > data/medi-journal.sqlite`
bei gestopptem Server.

**Off-Site-Sync:** `scripts/backup-offsite-sync.sh` ist ein rclone-Hook
(SPEC.md §4.4) — Remote/Ziel selbst konfigurieren (`rclone config`), dann
per Host-Cron wöchentlich aufrufen. Läuft bewusst außerhalb des Containers,
da rclone-Zugangsdaten nicht ins App-Image gehören.

## Status

M1–M3 umgesetzt. Siehe `docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md`.

Eine echte Export-Datei der alten HTML-Brückenlösung liegt lokal unter
`fixtures/bridge-export.json` (nicht im Git, enthält echte Gesundheitsdaten,
s. `.gitignore`) für den Import-Test (SPEC.md §11, Akzeptanzkriterium 4).
