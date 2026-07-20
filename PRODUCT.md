# Product

## Register

product

## Users

Einzelnutzer (der App-Betreiber selbst), mit ADHS. Nutzt die App primär abends
(tägliche Erinnerung default 21:00 Uhr), oft unter ADHS-typischer kognitiver
Last (Ablenkbarkeit, Prokrastination). Zusätzlich wöchentliche/14-tägige
klinische Selbsteinschätzungen (ASRS-6, PHQ-9).

## Product Purpose

Privates, self-hosted PWA-Tagebuch zur Wirkung/Nebenwirkung einer
ADHS-Medikation (Elvanse/Lisdexamfetamin, begleitend Quetiapin). Täglicher
Eintrag, wöchentliche validierte Selbsteinschätzungen, Ereignis-Log,
Verlaufs-Dashboard. Erfolg = der Nutzer trägt tatsächlich täglich ein, ohne
dass die App selbst zur Ablenkung/Reibung wird, und die Daten sind für ihn und
seine Ärzt:innen verständlich aufbereitet.

## Brand Personality

Warmes Abend-Tagebuch, kein klinisches Dashboard. Ruhig, unaufdringlich,
reibungsarm. Ernsthaft (validierte klinische Skalen, echte Gesundheitsdaten),
aber nicht kalt oder alarmierend.

## Anti-references

- Bunte Quantified-Self-Apps (Fitbit/Oura/Apple Health-Gradient-Ästhetik,
  Gamification, Badges) - falsche Tonalität für ein ernstes Medikations-Tagebuch
- Kalte Klinik-/Praxisverwaltungssoftware-Optik (Hellblau/Weiß, sterile
  Formulare) - passt nicht zum privaten, persönlichen Charakter
- Generischer KI-Design-Default: warme Creme + hochkontrastreiche Serife +
  Terrakotta-Akzent (AI-Slop-Muster) - eigene Richtung stattdessen dunkel-warm
  (Abend), gedämpfte Sage/Amber-Akzente, kein Neon/kühles Near-Black

## Design Principles

- Wärme statt Klinik-Kälte - die App soll sich wie ein persönliches Tagebuch
  anfühlen, nicht wie Praxissoftware
- Ruhe statt Reizüberflutung - zurückhaltende, gedämpfte Farben; keine
  unnötige Animation; ADHS-Zielgruppe profitiert von visueller Ruhe
- Self-hosted/Offline-first-Disziplin zieht sich auch durchs Design - keine
  CDN-Fonts, kleine Bundle-Größe, funktioniert offline (PWA)
- Funktion vor Dekoration - jedes Signature-Element (Dosier-Skala,
  Antwortreihe) muss zuerst die Bedienung verbessern (große Touch-Targets),
  Charakter ist ein Nebeneffekt guter Funktion

## Accessibility & Inclusion

WCAG AA (Kontrast ≥4.5:1 für Fließtext), große Touch-Targets (≥44×44px,
explizit aus SPEC.md §6 wegen ADHS-typisch beeinträchtigter Feinmotorik/
Aufmerksamkeit), vollständige Tastaturbedienbarkeit, `prefers-reduced-motion`
respektiert, Dark/Light nach Systemeinstellung (kein manueller Zwang zu einem
Modus).
