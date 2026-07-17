# Design: M1-Projektstruktur (Fundament)

Datum: 2026-07-17 · Status: genehmigt (nach adversarial review) · Bezug: `SPEC.md` §8 (M1 – Fundament)

## Kontext

`SPEC.md` deckt die gesamte App über sechs Meilensteine (M1–M6) ab. Dieses Design
begrenzt sich bewusst auf **M1 – Fundament**: Repo-Struktur, Tooling, SQLite-Schema,
Fastify-Grundgerüst mit `/healthz` und Auth-Stub, Docker Compose + Caddy lauffähig.
Spätere Meilensteine bekommen eigene Brainstorming-/Plan-Runden.

Offene Implementierer-Entscheidungen aus der Spec (§4.1, §4.2) wurden mit dem
Projektinhaber geklärt: Frontend Svelte, Backend Node+Fastify+SQLite, TypeScript
durchgehend, npm workspaces als Monorepo-Tooling. Ein adversarial Review gegen
`SPEC.md` und den alten HTML-Prototyp hat vier Korrekturen ergeben, die unten
eingearbeitet sind.

## Verzeichnislayout

```
medi-journal/
├── SPEC.md                    ← umbenannt von SPEC-Elvanse-Tagebuch-PWA.md (§11)
├── CLAUDE.md                  ← verweist verbindlich auf SPEC.md
├── README.md
├── package.json               ← npm workspaces Root ("app", "server")
├── docker-compose.yml         ← app + caddy Services
├── Caddyfile
├── .gitignore / .nvmrc
├── docs/superpowers/specs/    ← Design-Docs aus Brainstorming-Sessions
├── fixtures/                  ← bridge-export.json folgt später vom Projektinhaber (§11, AK4)
├── legacy-bridge/
│   └── elvanse-tagebuch-v2_1.html   ← alter HTML-Prototyp, Referenz für Import-Mapping (§5.6)
├── app/                        ← Vite + Svelte + TS (PWA-Frontend)
│   └── src/
└── server/                     ← Fastify + better-sqlite3 + TS (API)
    └── src/
```

## M1-Scope

- **Jetzt**: Ordnerstruktur, Tooling (TS strict, ESLint+Prettier, Vitest), SQLite-Schema
  (§3), Fastify-Grundgerüst (`/healthz`, Master-Passwort-Auth-Stub mit argon2id),
  Docker Compose + Caddy als lauffähiges Skelett, Vite-Dev-Proxy `/api` → Fastify.
- **Später (M2+)**: Sync-Endpunkte mit echter Last-Write-Wins-Logik, IndexedDB/Dexie,
  Service Worker, Tages-Eintrags-Screen (F1).

## Korrekturen aus dem adversarial Review

1. **Tombstones von Anfang an**: Alle vier Tabellen (`daily_entries`, `weekly_checks`,
   `phq9_checks`, `events`) erhalten sofort eine `deleted_at`-Spalte, wie von §4.2
   gefordert — vermeidet eine nachträgliche Migration in M2.
2. **Docker-Base-Image**: `node:slim` (Debian, glibc) statt `node:alpine`, da
   `better-sqlite3` ein natives Binary kompiliert und auf Alpine/musl ohne
   zusätzliche Toolchain häufig fehlschlägt.
3. **Datumsspalten als reines `TEXT`**: `date`-Spalten speichern `YYYY-MM-DD` ohne
   serverseitige Zeitzonen-Konvertierung (Tag wird laut §4.2 clientseitig in
   Europe/Berlin bestimmt). Verhindert Off-by-one-Risiken bei der in §3.1
   vorgeschriebenen Schlaf/Dosis-Lag-Logik.
4. **Vite-Dev-Proxy**: `server.proxy` in `app/vite.config.ts` leitet `/api` an den
   lokalen Fastify-Server weiter — vermeidet CORS-Reibung schon beim ersten
   `/healthz`-Test in der Entwicklung.

## Tooling-Details

- Node 26 gepinnt via `.nvmrc` (installierte lokale Version).
- Beide Packages: TypeScript strict mode, gemeinsame ESLint+Prettier-Config im Root.
- Vitest für Unit-Tests in `app/` und `server/`. Playwright kommt laut Spec erst in
  M6 dazu — noch nicht eingerichtet.
- `legacy-bridge/` bleibt unverändert im Repo (per `git mv`, Historie erhalten).

## Akzeptanz für M1 (Ausschnitt aus §7, was jetzt schon prüfbar ist)

- `docker compose up` startet `app`+`caddy`, `GET /healthz` antwortet unauthentifiziert.
- Server-Neustart/Container-Neubau: Daten bleiben im Volume erhalten (Grundlage für
  AK3, vollständig testbar erst mit echten Daten in M2/M3).
