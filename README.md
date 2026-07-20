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

## Import/Export

- `GET /api/v1/export.json` — Vollexport, natives Schema (§3.1-Feldnamen, `version: 3`)
- `GET /api/v1/export.csv` — eine Zeile pro Tag, deutsche Spaltenköpfe, `;`-getrennt, UTF-8 mit BOM
- `POST /api/v1/import` — akzeptiert sowohl Bridge-Exporte der alten HTML-Version
  (`version: 2`, deutsches camelCase, Feld-Mapping in `server/src/import.ts`) als
  auch eigene `export.json`-Dateien (`version: 3`, direkter Pass-through)

## Web Push

Tägliche Erinnerung (Default 21:00 Europe/Berlin), Sonntags-Wochen-Check,
PHQ-9 alle 14 Tage — Payload enthält bewusst keine sensiblen Inhalte (nur
"Kurz eintragen?", SPEC.md §5.5). Fallback ohne erteilte Berechtigung: Badge
"Seit mehreren Tagen kein Eintrag" beim Öffnen.

```bash
npm run generate-vapid-keys --workspace server -- mailto:du@example.com
# Ausgabe als VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT in .env eintragen
```

`POST /api/v1/push/test-send` löst sofort einen Testversand an alle
registrierten Geräte aus (unabhängig von Fälligkeit) — nützlich, um den
Zustellpfad ohne Warten auf 21:00 Uhr zu verifizieren.

## Status

M1–M4 sowie M5a (Dashboard) und M5b (Web Push) vollständig umgesetzt. Siehe
`docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md`.

M5 wurde bewusst auf die beiden aktuell relevanten Features verschlankt
(Dashboard, Web Push) — Arztbericht (F4) und Passkey-Login sind vorerst
zurückgestellt.

Web Push (VAPID, self-hosted) ist end-to-end in Desktop-Chrome verifiziert
(echter Subscribe- und Zustellpfad über Googles FCM-Push-Service). Der laut
SPEC.md §11 vorgeschriebene manuelle Test auf einem echten iPhone (iOS
verlangt Standalone-Installation für Web Push, PWA-Verhalten lässt sich nicht
vollständig emulieren) steht noch aus.

Eine echte Export-Datei der alten HTML-Brückenlösung liegt lokal unter
`fixtures/bridge-export.json` (nicht im Git, enthält echte Gesundheitsdaten,
s. `.gitignore`) — der Import wurde damit gegen echte Daten getestet
(SPEC.md §11, Akzeptanzkriterium 4).
