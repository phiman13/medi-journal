-- Schema für medi-journal, siehe SPEC.md §3.
--
-- Datumsspalten (date, week_start) sind absichtlich reines TEXT im Format
-- YYYY-MM-DD, ohne serverseitige Zeitzonen-Konvertierung. Der "Tag" wird laut
-- SPEC.md §4.2 clientseitig in Europe/Berlin bestimmt; der Server übernimmt den
-- String unverändert. SQLite kennt keinen nativen DATE-Typ.
--
-- Jede Tabelle hat `deleted_at` als Tombstone-Spalte für die Last-Write-Wins-
-- Sync-Strategie aus SPEC.md §4.2 ("Gelöschte Records als Tombstones
-- synchronisieren").

CREATE TABLE IF NOT EXISTS daily_entries (
  date                  TEXT PRIMARY KEY,
  med_taken             INTEGER NOT NULL,
  med_dose_mg           INTEGER,
  med_time              TEXT,
  wear_off_time         TEXT,
  quetiapine_taken      INTEGER,
  quetiapine_dose_mg    INTEGER,
  focus                 INTEGER NOT NULL,
  task_initiation       INTEGER NOT NULL,
  inner_calm            INTEGER NOT NULL,
  emotional_stability   INTEGER NOT NULL,
  mood                  INTEGER NOT NULL,
  day_function          INTEGER NOT NULL,
  accomplished          TEXT,
  sleep_hours           REAL,
  sleep_quality         INTEGER,
  appetite              TEXT,
  resting_hr            INTEGER,
  bp_sys                INTEGER,
  bp_dia                INTEGER,
  caffeine_units        INTEGER,
  alcohol               INTEGER,
  side_effects          TEXT,
  side_effects_other    TEXT,
  flags                 TEXT,
  notes                 TEXT,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);

CREATE TABLE IF NOT EXISTS weekly_checks (
  week_start            TEXT PRIMARY KEY,
  asrs                  TEXT NOT NULL,
  asrs_score            INTEGER NOT NULL,
  weight_kg             REAL,
  bp_sys                INTEGER,
  bp_dia                INTEGER,
  hr                    INTEGER,
  effect_duration_h     REAL,
  week_rating           TEXT,
  notes                 TEXT,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);

CREATE TABLE IF NOT EXISTS phq9_checks (
  date                  TEXT PRIMARY KEY,
  answers               TEXT NOT NULL,
  score                 INTEGER NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id                    TEXT PRIMARY KEY,
  date                  TEXT NOT NULL,
  type                  TEXT NOT NULL,
  title                 TEXT NOT NULL,
  details               TEXT,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);

-- Single-Row-Settings (ein Nutzer, s. SPEC.md §3.5): `data` enthält Medikation
-- & Standarddosen, Erinnerungszeiten, PHQ-9-Intervall, Krisenkontakte,
-- individuelle Nebenwirkungs-Items, Exportvorlagen-Optionen als JSON-Blob.
CREATE TABLE IF NOT EXISTS settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  data                  TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
