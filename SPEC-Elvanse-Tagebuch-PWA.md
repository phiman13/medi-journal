# Spezifikation: „Medikations-Tagebuch“ – selbstgehostete PWA

Version 1.0 · 17.07.2026 · Autor: Philipp (mit Claude) · Zielumsetzung: Claude Code

---

## 1. Ziel und Kontext

Eine **private, selbstgehostete Progressive Web App** zum täglichen Tracking der Wirkung und Nebenwirkungen von ADHS-Medikation (aktuell Elvanse/Lisdexamfetamin, begleitend Quetiapin), mit wöchentlichen validierten Selbsteinschätzungen (ASRS-6, PHQ-9) und arzttauglichen Auswertungen.

Kernanforderungen aus Nutzersicht:

1. **Multi-Device mit aktuellem Datenstand**: iPhone (Safari-PWA, installiert auf dem Homescreen) und macOS-Browser greifen auf denselben Datenbestand zu.
2. **Kein Datenverlust, jemals**: Offline-first mit lokaler Persistenz, Server-Sync, automatischen Server-Backups und manuellem Export.
3. **Privatsphäre**: Gesundheitsdaten bleiben ausschließlich auf dem eigenen VPS. Keine Third-Party-Dienste, keine Analytics, keine CDNs zur Laufzeit.
4. **2-Minuten-Eintrag**: Die tägliche Erfassung muss auf dem iPhone in unter 2 Minuten möglich sein.
5. **Arzttauglich**: Export/Report, der die Fragen „Wirkt es? Zu welchem Preis?“ auf einen Blick beantwortet.

Ein einzelner Nutzer (der Betreiber). Sprache der UI: Deutsch. Bestehende Daten aus der HTML-Brückenlösung (JSON-Export, Format `elvanse-tagebuch`, Version 2 – siehe §5.6) müssen importierbar sein.

## 2. Fachlicher Hintergrund (Rationale für das Datenmodell)

Das Datenmodell folgt den Monitoring-Empfehlungen der NICE-Leitlinie NG87 (ADHS) und gängigen validierten Instrumenten:

- **NICE NG87**: Bei Titration sollen Symptome, Funktionsniveau (Alltag/Arbeit/Beziehungen) und Nebenwirkungen zu Baseline und bei **jeder Dosisänderung** auf Standardskalen erfasst und wöchentlich reviewt werden. **Puls und Blutdruck** vor und nach jeder Dosisänderung sowie danach halbjährlich; **Gewicht** halbjährlich (bei Gewichtsverlust engmaschiger); **Schlaf** per Schlaftagebuch; auf Tics, sexuelle Funktionsstörungen und Verhaltensverschlechterung achten. Erfolgreiche Titration = Symptomreduktion **plus** funktionelle Verbesserung bei tolerablen Nebenwirkungen.
- **ASRS v1.1 (WHO)**: 18-Item-Selbstbericht; die **6-Item-Kurzform (Teil A)** ist der am besten validierte Screener und eignet sich als wöchentliches Verlaufsmaß (Frequenzskala 0–4, Score 0–24).
- **PHQ-9**: Standard-Depressionsverlaufsmaß (0–27), 14-tägig – wichtig wegen der Depressionsvorgeschichte und der offenen Frage, ob die depressive Symptomatik sekundär zur ADHS ist. Item 9 (Suizidgedanken) erfordert eine sensible UI-Behandlung (siehe §5.2).
- **Stimulanzien-Nebenwirkungsskalen** (z. B. Barkley Side Effects Rating Scale): definierte Checkliste statt Freitext – Schlafprobleme, Appetitverlust, Kopf-/Bauchschmerzen, Reizbarkeit, Angst/Anspannung, Tics, Schwindel, Herzklopfen u. a.
- **Wirkdauer/Rebound**: Lisdexamfetamin wirkt typischerweise 10–14 h; Wirkende-Zeitpunkt und Rebound/„Crash“ am Nachmittag/Abend sind titrationsrelevant und werden täglich erfasst.

Wichtige nutzerspezifische Ergänzungen: Quetiapin-Begleitmedikation (Schlaf), Beobachtung „Rausch-/High-Gefühl“ (in den ersten Tagen normal, sollte abklingen), individuelle Nebenwirkung „Hodenschmerzen“ (unter Milnacipran aufgetreten, daher explizit beobachten), Koffein/Alkohol als Kontextfaktoren.

## 3. Datenmodell

Alle Zeitstempel ISO-8601 mit Zeitzone. Primärschlüssel für Tageseinträge ist das Kalenderdatum (`YYYY-MM-DD`, Europe/Berlin).

### 3.1 `daily_entries` (täglicher Abend-Eintrag, Soll-Dauer < 2 min)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `date` | date (PK) | ja | Kalendertag |
| `med_taken` | bool | ja | Elvanse eingenommen? |
| `med_dose_mg` | int | wenn taken | Dosis in mg (Vortageswert vorbelegt) |
| `med_time` | time | nein | Einnahmezeit |
| `wear_off_time` | time | nein | Wann ließ die Wirkung spürbar nach? |
| `quetiapine_taken` | bool | nein | Quetiapin am Abend |
| `quetiapine_dose_mg` | int | nein | Dosis (vorbelegt) |
| `focus` | int 1–10 | ja | Fokus / Ablenkbarkeit |
| `task_initiation` | int 1–10 | ja | Ins Tun kommen / Aufschieben |
| `inner_calm` | int 1–10 | ja | Innere Ruhe (Gedankenkreisen, Getriebenheit) |
| `emotional_stability` | int 1–10 | ja | Emotionale Ausgeglichenheit / Reizbarkeit invers |
| `mood` | int 1–10 | ja | Stimmung |
| `day_function` | int 1–10 | ja | Tagesfunktion gesamt (Arbeit/Alltag bewältigt?) |
| `accomplished` | text | nein | „Was habe ich geschafft?“ (funktionelles Anker-Feld) |
| `sleep_hours` | decimal | nein | Schlaf der Vornacht |
| `sleep_quality` | int 1–10 | nein | Schlafqualität Vornacht |
| `appetite` | enum | nein | `normal` / `reduziert` / `stark_reduziert` |
| `resting_hr` | int | nein | Ruhepuls (bpm) |
| `bp_sys`, `bp_dia` | int | nein | Blutdruck, falls gemessen |
| `caffeine_units` | int | nein | Koffeinportionen (Kaffee/Energy) |
| `alcohol` | bool | nein | Alkohol konsumiert |
| `side_effects` | string[] | nein | Aus fester Liste, s. u. |
| `side_effects_other` | text | nein | Freitext |
| `flags` | string[] | nein | `rausch_gefuehl`, `rebound_crash` |
| `notes` | text | nein | Freitext |
| `updated_at` | timestamp | auto | Für Sync (Last-Write-Wins) |

Nebenwirkungsliste (fest, erweiterbar über Settings): `einschlafprobleme`, `appetitverlust`, `kopfschmerzen`, `magen_darm`, `mundtrockenheit`, `schwitzen`, `herzklopfen`, `schwindel`, `angst_anspannung`, `reizbarkeit`, `tics_zucken`, `libido_sexuell`, `hodenschmerzen`.

**Zeitbezugs-Konvention (verbindlich):** Der Eintrag von Tag X wird abends an Tag X erstellt. Alle Schlaf-Felder (`sleep_hours`, `sleep_quality`) **und** die Nebenwirkung `einschlafprobleme` beziehen sich auf die **Nacht davor** (X−1 → X) – abends kann man die kommende Nacht noch nicht beurteilen. Alle übrigen Felder beziehen sich auf Tag X selbst. Die UI beschriftet das eindeutig („Schlaf (letzte Nacht)“, „Einschlafprobleme (letzte Nacht)“). **Konsequenz für jede Auswertung** (Dashboard F3, Arztbericht F4): Bei Korrelationen von Dosis/Einnahmezeit mit Schlaf müssen die Schlafwerte des Eintrags X der Medikation von Tag **X−1** zugeordnet werden (Lag von einem Tag). Charts, die „Schlaf nach Dosisänderung“ zeigen, verschieben die Schlafserie entsprechend um einen Tag.

### 3.2 `weekly_checks` (jeden Sonntag, Soll-Dauer < 5 min)

| Feld | Typ | Beschreibung |
|---|---|---|
| `week_start` | date (PK) | Montag der Woche |
| `asrs` | int[6], je 0–4 | ASRS v1.1 Teil A (Frequenzskala: nie/selten/manchmal/oft/sehr oft) |
| `asrs_score` | computed | Summe 0–24 |
| `weight_kg` | decimal | Gewicht (NICE: bei Stimulanzien beobachten) |
| `bp_sys`, `bp_dia`, `hr` | int | Wochenmessung Blutdruck/Puls |
| `effect_duration_h` | decimal | Geschätzte Wirkdauer (typisch diese Woche) |
| `week_rating` | enum | `deutlich_besser` / `etwas_besser` / `gleich` / `schlechter` (Gesamteindruck vs. Vorwoche) |
| `notes` | text | |
| `updated_at` | timestamp | |

### 3.3 `phq9_checks` (14-tägig, App erinnert)

`date` (PK), `answers` int[9] je 0–3, `score` computed 0–27, Schweregrad-Label (0–4 minimal, 5–9 mild, 10–14 moderat, 15–19 mittelgradig, 20–27 schwer), `updated_at`.

**Item 9 > 0** → App zeigt unaufdringlich einen unterstützenden Hinweis mit Krisenkontakten (konfigurierbar in Settings, Default: Telefonseelsorge 0800 111 0 111 / 116 123) und empfiehlt, das ärztlich anzusprechen. Kein Alarmismus, keine Blockade der App.

### 3.4 `events` (Ereignis-Log, entscheidend für die Interpretation der Kurven)

`id`, `date`, `type` (enum: `dosisänderung`, `medikament_start`, `medikament_stopp`, `arzttermin`, `sonstiges`), `title`, `details`, `updated_at`. Beispiele: „Elvanse 30 → 50 mg“, „Duloxetin nicht begonnen“, „Telefon-Check-in Dr. X“. Events werden in allen Charts als vertikale Markierungslinien gerendert.

### 3.5 `settings`

Aktuelle Medikation & Standarddosen, Erinnerungszeiten, PHQ-9-Intervall, Krisenkontakte, individuelle Nebenwirkungs-Items, Exportvorlagen-Optionen.

## 4. Architektur

**Prinzip: so wenig bewegliche Teile wie möglich.** Ein Nutzer, ein Server, kleine Datenmengen (< 1 MB/Jahr).

### 4.1 Frontend (PWA)

- **Stack**: Vite + **Svelte** (oder Preact – Entscheidung dem Implementierer überlassen, aber kein schweres Framework). Ein Build, statisch ausgeliefert. Keine Runtime-CDN-Abhängigkeiten; alle Assets self-hosted.
- **Offline-first**: Alle Daten lokal in **IndexedDB** (z. B. via Dexie). Die App ist ohne Netz voll funktionsfähig (Erfassen, Ansehen, Export).
- **Service Worker**: Precaching der App-Shell (Workbox oder handgeschrieben), Update-Flow mit „Neue Version verfügbar“-Hinweis.
- **Installierbarkeit**: Web App Manifest (Name, Icons, `display: standalone`, Theme-Farben). Auf iOS via „Zum Home-Bildschirm“. iOS-Eigenheiten beachten: PWA-Storage kann vom System gelöscht werden, wenn die App vom Homescreen entfernt wird → der Server ist die Quelle der Wahrheit, IndexedDB ist Cache + Offline-Puffer.
- **Push-Erinnerungen**: Web Push (VAPID, self-hosted; iOS unterstützt Web Push für installierte PWAs seit 16.4). Tägliche Erinnerung (Default 21:00), Sonntags-Check, PHQ-9 alle 14 Tage. Fallback, falls Push nicht bewilligt: Badge/Hinweis beim Öffnen („3 Tage ohne Eintrag“).
- **UI-Anforderungen**: Dark/Light nach Systemeinstellung; Slider/Stepper mit großen Touch-Targets; Formular merkt sich Vortageswerte für Dosis/Quetiapin; „Nachtragen“-Flow für vergessene Tage; alles mit Tastatur bedienbar.

### 4.2 Backend

- **Stack**: Node.js (LTS) + **Fastify** + **SQLite** (Datei-DB; `better-sqlite3`). Kein ORM nötig. Alternativ Go + SQLite, falls der Implementierer das bevorzugt – API-Vertrag bleibt gleich.
- **API** (JSON, alle Routen unter `/api/v1`, authentifiziert):
  - `GET /sync?since=<timestamp>` → alle geänderten Records aller Tabellen seit `since`
  - `POST /sync` → Batch-Upsert von Records `{table, records[]}`; Antwort enthält Serverstand der betroffenen Keys
  - `GET /export.json` (Vollexport im Format §5.6), `GET /export.csv` (daily flach)
  - `POST /import` (JSON-Format §5.6; merge, Konfliktregel wie Sync)
  - `GET /report?from&to` → aggregierte Reportdaten für den Arztbericht
  - `POST /push/subscribe`, `DELETE /push/subscribe`
  - `GET /healthz` (unauthentifiziert, für Uptime-Monitoring)
- **Sync-Strategie**: **Last-Write-Wins pro Record** anhand `updated_at` (Client-Uhr + Server-Empfangszeit als Tiebreaker). Bei einem Einzelnutzer, der realistisch nicht auf zwei Geräten gleichzeitig denselben Tag editiert, ist das ausreichend; kein CRDT-Overhead. Gelöschte Records als Tombstones (`deleted_at`) synchronisieren.
- **Zeitzone**: Server speichert UTC; „Tag“ wird immer clientseitig in Europe/Berlin bestimmt.

### 4.3 Auth & Sicherheit

- Single-User-Auth: **Passkey/WebAuthn** als primärer Login, Fallback Master-Passwort (argon2id-Hash). Session als httpOnly-Cookie (30 Tage, rolling). Kein OAuth, keine Dritten.
- **HTTPS zwingend**; Reverse Proxy **Caddy** (automatisches Let's Encrypt). HSTS. App verweigert Betrieb über http.
- Rate-Limiting auf Auth-Routen; CORS nur eigene Origin; CSP strikt (`default-src 'self'`).
- Optional (nice-to-have): clientseitige Verschlüsselung der Freitextfelder (WebCrypto, Schlüssel aus Passphrase) – als Ausbaustufe, nicht MVP.

### 4.4 Backup (Pflicht, Teil des MVP)

- Nächtlicher Cron im Container: `sqlite3 .backup` → datierte Kopie, Aufbewahrung 30 Tage täglich + 12 Monate monatlich, `gzip`.
- Wöchentlicher, verschlüsselter Off-Site-Sync des Backup-Ordners ist vorzubereiten (rclone-Hook dokumentieren, Ziel konfiguriert der Betreiber selbst).
- `GET /export.json` zusätzlich als manueller „alles in eine Datei“-Ausweg, prominent in den Settings verlinkt.

### 4.5 Deployment

- **Docker Compose** mit zwei Services: `app` (Node, served static + API) und `caddy`. Volumes für SQLite-DB und Backups. `.env` für Secrets (VAPID-Keys, Session-Secret).
- Ein `make deploy`/Skript-Weg für: Build → Image → auf VPS ziehen → `docker compose up -d`. README mit Erstinstallation (Domain, DNS, Passkey-Registrierung beim ersten Start via einmaligem Setup-Token aus dem Server-Log).

## 5. Funktionale Anforderungen

### 5.1 Täglicher Eintrag (F1)

- Ein Bildschirm, vertikal scrollbar, Reihenfolge: Medikation → 6 Kernskalen → „Was geschafft“ → Schlaf → Körper (Appetit/Puls/RR) → Kontext (Koffein/Alkohol) → Nebenwirkungs-Chips → Notizen.
- Datum default heute; bestehender Eintrag wird geladen und editiert (Upsert). Nachtragen vergangener Tage möglich; Zukunft gesperrt.
- Speichern ist **ein Tap**, danach sofortige lokale Persistenz + Hintergrund-Sync (sichtbarer Sync-Status: „lokal gespeichert · synchronisiert ✓“).

### 5.2 Wochen-Check & PHQ-9 (F2)

- Sonntags (bzw. beim ersten App-Öffnen danach) bietet die App den Wochen-Check an: ASRS-6, Gewicht, RR/Puls, Wirkdauer, Gesamteindruck.
- Alle 14 Tage zusätzlich PHQ-9. Verhalten bei Item 9 > 0 siehe §3.3.
- Scores werden sofort mit Verlaufskontext angezeigt („ASRS 14 → vor einer Woche 17“).

### 5.3 Auswertung (F3)

- **Dashboard**: 7-Tage-Mittel der 6 Kernskalen mit Delta zur Vorwoche; Liniendiagramm (wählbare Serien, Default Fokus/Stimmung/Tagesfunktion) mit Event-Markern; ASRS- und PHQ-9-Verlauf; Schlaf- und Appetit-Übersicht; Nebenwirkungs-Häufigkeit (Top-Liste mit Tagen-Anzahl).
- Charts nativ (SVG) oder mit einer kleinen self-hosted Lib; Dark-Mode-fähig; keine externen Fonts/CDNs.

### 5.4 Arztbericht (F4)

- „Bericht erstellen“ mit Zeitraum → druckbare HTML-Seite / PDF: Medikations- und Dosishistorie (aus Events), Wochenmittel-Tabelle, ASRS/PHQ-9-Verlauf, Vitalwerte, Nebenwirkungs-Zusammenfassung, freies Feld „Fragen an die Ärztin“.
- Eine A4-Seite Zusammenfassung + Anhang Rohdatentabelle.

### 5.5 Erinnerungen (F5)

Web Push wie §4.1. Erinnerung enthält keine sensiblen Inhalte (nur „Kurz eintragen?“ – Sperrbildschirm-Datenschutz).

### 5.6 Import/Export-Format (F6)

Vollexport = eine JSON-Datei:

```json
{
  "app": "elvanse-tagebuch",
  "version": 2,
  "exported": "2026-07-17T21:00:00+02:00",
  "entries":  { "YYYY-MM-DD": { /* daily_entry, Feldnamen wie §3.1 */ } },
  "weekly":   { "YYYY-MM-DD": { /* weekly_check */ } },
  "phq9":     { "YYYY-MM-DD": { /* phq9_check */ } },
  "events":   [ { /* event */ } ],
  "settings": { }
}
```

**Achtung – Wire-Format ≠ DB-Schema:** Die Brücken-HTML verwendet in `entries`/`weekly`/`phq9` deutsche camelCase-Feldnamen. Der PWA-Import (F6) MUSS genau diese Namen lesen und auf das DB-Schema (§3.1–3.3) mappen:

| Wire (Bridge-JSON v2) | DB (§3.1) | Wire | DB |
|---|---|---|---|
| `taken` („ja“/„nein“) | `med_taken` (bool) | `sleepHours` | `sleep_hours` |
| `dose` (string!) | `med_dose_mg` (int) | `sleepQ` | `sleep_quality` |
| `time` | `med_time` | `appetit` („normal“/„reduziert“/„stark reduziert“) | `appetite` (enum) |
| `wearOff` | `wear_off_time` | `puls` | `resting_hr` |
| `quetiapin` („ja“/„nein“) | `quetiapine_taken` | `bpSys` / `bpDia` | `bp_sys` / `bp_dia` |
| `fokus` | `focus` | `koffein` | `caffeine_units` |
| `task` | `task_initiation` | `alkohol` („ja“/„nein“) | `alcohol` (bool) |
| `ruhe` | `inner_calm` | `flags` (dt. Labels) | `flags` (Slugs) |
| `emo` | `emotional_stability` | `sideEffects` (dt. Labels) | `side_effects` (Slugs) |
| `stimmung` | `mood` | `geschafft` | `accomplished` |
| `funktion` | `day_function` | `notizen` / `updatedAt` | `notes` / `updated_at` |

`weekly`: Keys = Montag (`YYYY-MM-DD`); Felder `weekStart`, `asrs` (int[6]), `asrsScore`, `weight`, `bpSys`, `bpDia`, `hr`, `effectDurationH`, `rating` (dt. Labels), `notes`, `updatedAt`. `phq9`: Keys = Ausfülldatum; Felder `date`, `answers` (int[9]), `score`, `updatedAt`. Numerische Werte kommen aus der Bridge teils als String (leere Strings = nicht erfasst) – beim Import nach int/decimal bzw. `null` konvertieren. Deutsche Chip-Labels (z. B. „Rausch-/High-Gefühl“, „Magen/Darm“, „Einschlafprobleme“) 1:1 auf die Slug-Liste aus §3.1 mappen; unbekannte Labels nach `side_effects_other` übernehmen, nie verwerfen. Der Importer ist mit einer echten Bridge-Exportdatei zu testen (Akzeptanzkriterium 4). CSV-Export: eine Zeile pro Tag, deutsche Spaltenköpfe, `;`-getrennt, UTF-8 mit BOM.

## 6. Nichtfunktionale Anforderungen

- Lighthouse-PWA-Kriterien erfüllt; Time-to-Interactive < 2 s auf iPhone über 4G.
- Gesamt-JS < 200 kB gzipped (Richtwert – schlank bleiben).
- Barrierefreiheit: Labels/ARIA für alle Controls, Kontrast AA, Bedienung ohne Präzisions-Gesten.
- Datenschutz: keine Requests an fremde Hosts (überprüfbar via CSP); Logs ohne Gesundheitsdaten; IP-Logging im Proxy minimieren.
- Robustheit: App-Start und Eintrag funktionieren bei Server-Ausfall (offline) uneingeschränkt; Sync holt später auf.

## 7. Akzeptanzkriterien (Auszug, testbar)

1. Eintrag auf dem iPhone anlegen (Flugmodus an) → App zeigt „lokal gespeichert“; Flugmodus aus → Status „synchronisiert“; Eintrag erscheint ohne Reload am Mac (nach Sync-Poll/Push).
2. Denselben Tag nacheinander auf zwei Geräten editieren → der spätere Stand gewinnt vollständig; kein Duplikat, kein Datenverlust anderer Tage.
3. Server-Neustart und Container-Neubau → alle Daten vorhanden (Volume); Restore aus nächtlichem Backup dokumentiert und einmal durchgespielt.
4. Import der Brücken-JSON (Version 2) → alle Tages- und Wocheneinträge korrekt übernommen, Beispiel-/Testdatensatz verifiziert.
5. PHQ-9 mit Item 9 = 1 beantwortet → Hinweisdialog mit Krisenkontakten erscheint, Antwort wird normal gespeichert.
6. App eine Woche nicht geöffnet → beim Öffnen Hinweis auf fehlende Tage + Nachtragen-Flow.
7. `npm audit`/aktuelle Dependencies ohne bekannte kritische CVEs; CSP blockiert testweise eingefügte externe Ressourcen.

## 8. Implementierungsreihenfolge (Vorschlag für Claude Code)

1. **M1 – Fundament**: Repo-Setup (Monorepo `app/` + `server/`), SQLite-Schema, Fastify-API (Auth mit Master-Passwort zuerst), Docker Compose + Caddy, healthz.
2. **M2 – Kern**: Täglicher Eintrag (F1) Ende-zu-Ende inkl. IndexedDB, Sync, Upsert; Dashboard-Minimalversion (Liste + eine Kurve).
3. **M3 – Robustheit**: Service Worker/Offline, Backup-Cron + Restore-Doku, Import Brücken-JSON (F6), Export.
4. **M4 – Klinische Module**: Wochen-Check + ASRS (F2), PHQ-9 inkl. Item-9-Verhalten, Events + Chart-Marker.
5. **M5 – Komfort**: Vollständiges Dashboard (F3), Arztbericht (F4), Web Push (F5), Passkey-Login.
6. **M6 – Politur**: A11y-Pass, Lighthouse, E2E-Tests (Playwright) für die Akzeptanzkriterien.

## 9. Out of Scope

Mehrbenutzerbetrieb, Therapeuten-Zugänge, native Apps, HealthKit-Integration, KI-Auswertung, Mandantenfähigkeit. Medizinprodukt-Zertifizierung ist nicht angestrebt; die App ist ein privates Tagebuch und ersetzt keine ärztliche Beratung (Hinweis im Footer).

## 10. Anhang: Verbindliche Fragetexte (deutsch, identisch zur Brückenlösung)

**ASRS-6** (Bezugsrahmen: letzte 7 Tage; Antwortskala 0 = nie, 1 = selten, 2 = manchmal, 3 = oft, 4 = sehr oft):
1. Letzte Details einer Aufgabe abschließen, wenn das Schwierige erledigt ist
2. Dinge ordnen/organisieren, wenn eine Aufgabe Planung erfordert
3. An Termine oder Verpflichtungen denken
4. Beginn aufschieben, wenn eine Aufgabe viel Nachdenken erfordert
5. Zappeln/Unruhe mit Händen oder Füßen bei längerem Sitzen
6. Übermäßig aktiv und getrieben, „wie von einem Motor angetrieben“

**PHQ-9** (Bezugsrahmen: letzte 2 Wochen; Antwortskala 0 = überhaupt nicht, 1 = an einzelnen Tagen, 2 = an mehr als der Hälfte der Tage, 3 = beinahe jeden Tag):
1. Wenig Interesse oder Freude an Tätigkeiten
2. Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit
3. Ein-/Durchschlafprobleme oder vermehrter Schlaf
4. Müdigkeit oder Gefühl, keine Energie zu haben
5. Verminderter Appetit oder übermäßiges Essbedürfnis
6. Schlechte Meinung von sich selbst; Gefühl zu versagen
7. Konzentrationsschwierigkeiten (z. B. beim Lesen/Fernsehen)
8. Verlangsamung – oder Gegenteil: rastlose Unruhe
9. Gedanken, besser tot zu sein oder sich Leid zuzufügen

Schweregrade PHQ-9: 0–4 minimal · 5–9 mild · 10–14 moderat · 15–19 mittelgradig schwer · 20–27 schwer. Verhalten bei Item 9 > 0: siehe §3.3.

## 11. Hinweise zur Umsetzung mit Claude Code

- Diese Datei als `SPEC.md` ins Repo-Root legen; in `CLAUDE.md` darauf verweisen („SPEC.md ist die verbindliche Anforderungsquelle; bei Widersprüchen nachfragen statt raten“).
- Pro Session einen Meilenstein (§8) umsetzen lassen, nicht alles auf einmal; nach jedem Meilenstein die zugehörigen Akzeptanzkriterien (§7) als automatisierte Tests einfordern.
- Eine echte Export-Datei der Brückenlösung als Test-Fixture ins Repo legen (`fixtures/bridge-export.json`), damit der Import (F6) gegen reale Daten getestet wird.
- Vor M5 (Push, Passkey) einen manuellen End-to-End-Test auf dem echten iPhone einplanen – PWA-Verhalten unter iOS lässt sich nicht vollständig emulieren.

## 12. Quellen (fachliche Grundlage)

- NICE NG87: Attention deficit hyperactivity disorder: diagnosis and management – Monitoring-Empfehlungen (HR/RR je Dosisänderung + halbjährlich, Gewicht, Schlaftagebuch, Symptom-/Funktions-/Nebenwirkungserfassung bei Titration): https://www.ncbi.nlm.nih.gov/books/NBK493361/
- ASRS v1.1 (WHO, 18 Items, 6-Item-Screener Teil A, Frequenzskala 0–4): https://novopsych.com/assessments/diagnosis/adult-adhd-self-report-scale-asrs/ · Originalfragebogen: https://add.org/wp-content/uploads/2015/03/adhd-questionnaire-ASRS111.pdf
- Monitoring der Treatment-Response bei adulter ADHS (Übersicht): https://pmc.ncbi.nlm.nih.gov/articles/PMC5291336/
- Stimulanzien-Nebenwirkungs-Rating (Barkley-basiert): https://cla.auburn.edu/media/lekpe3hs/stimulant-side-effects-rating-scale.pdf
- Wirkdauer/Rebound bei Lisdexamfetamin: https://www.additudemag.com/adhd-medication-rebound/ · https://trygraymatter.com/blogs/science/how-long-does-vyvanse-last
- PHQ-9: frei verwendbares Standardinstrument (Pfizer/Spitzer), Schweregrade 5/10/15/20.
