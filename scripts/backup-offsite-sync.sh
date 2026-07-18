#!/bin/sh
# Wöchentlicher, verschlüsselter Off-Site-Sync des Backup-Ordners (SPEC.md §4.4).
#
# Bewusst ein Platzhalter-Hook, kein Auto-Setup: rclone-Remote und Ziel
# konfiguriert der Betreiber selbst (rclone config). rclone-Zugangsdaten
# gehören NICHT ins App-Image - dieses Skript läuft daher außerhalb des
# Containers, direkt auf dem VPS-Host, per eigenem Host-Cron-Eintrag, z. B.:
#
#   0 4 * * 0 /pfad/zu/medi-journal/scripts/backup-offsite-sync.sh
#
# Voraussetzung: rclone ist auf dem Host installiert und mit einem
# verschlüsselten Remote konfiguriert (z. B. "rclone config" -> Storage-Typ
# "crypt" über einem Cloud-Backend). Ziel unten eintragen, sobald konfiguriert.

set -eu

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
RCLONE_REMOTE=""  # z. B. "meinbackup:medi-journal" - vom Betreiber zu setzen

if [ -z "$RCLONE_REMOTE" ]; then
  echo "rclone-Hook: RCLONE_REMOTE ist noch nicht konfiguriert. Siehe Kommentar oben." >&2
  exit 1
fi

rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --checksum
