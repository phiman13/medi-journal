# medi-journal

`SPEC.md` ist die verbindliche Anforderungsquelle für dieses Projekt. Bei
Widersprüchen zwischen Code, Kommentaren oder eigenen Annahmen und `SPEC.md`:
nachfragen statt raten.

Design-Entscheidungen aus Brainstorming-Sessions liegen unter
`docs/superpowers/specs/`.

`legacy-bridge/` enthält den alten HTML-Prototyp — dient nur als Referenz für
das Import-Mapping (SPEC.md §5.6), nicht mehr aktiv weiterentwickeln.

## Meilensteine

Reihenfolge laut `SPEC.md` §8: M1 (Fundament) → M2 (Kern) → M3 (Robustheit) →
M4 (Klinische Module) → M5 (Komfort) → M6 (Politur). Pro Session einen
Meilenstein umsetzen, nicht alles auf einmal.

**Stand:** M1–M6 umgesetzt (s. `README.md` "Status" für Details/Einschrän-
kungen, z. B. bei M5 bewusst ausgelassene Teile). Noch offen: Arztbericht
(F4), Passkey-Login, Import-UI (F6 hat nur den API-Endpoint, kein Button in
der App) - alle drei bewusst zurückgestellt, kein technischer Blocker.

## Stack (M1-Entscheidungen)

- Frontend: Vite + Svelte + TypeScript (`app/`)
- Backend: Fastify + better-sqlite3 + TypeScript (`server/`)
- Monorepo: npm workspaces
- Tests: Vitest (`npm test`, beide Workspaces) + Playwright-E2E (`npm run
  test:e2e`, s. `e2e/`) seit M6 umgesetzt
