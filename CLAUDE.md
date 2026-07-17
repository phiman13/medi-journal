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

## Stack (M1-Entscheidungen)

- Frontend: Vite + Svelte + TypeScript (`app/`)
- Backend: Fastify + better-sqlite3 + TypeScript (`server/`)
- Monorepo: npm workspaces
- Tests: Vitest (Playwright folgt erst in M6)
