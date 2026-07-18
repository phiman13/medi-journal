// Spiegelt server/src/db/events.ts (SPEC.md §3.4).
export interface JournalEvent {
  id: string;
  date: string;
  type: "dosisänderung" | "medikament_start" | "medikament_stopp" | "arzttermin" | "sonstiges";
  title: string;
  details: string | null;
  updated_at: string;
  deleted_at: string | null;
  server_received_at?: string;
  sync_status: "pending" | "synced";
}

export const EVENT_TYPES: { value: JournalEvent["type"]; label: string }[] = [
  { value: "dosisänderung", label: "Dosisänderung" },
  { value: "medikament_start", label: "Medikament Start" },
  { value: "medikament_stopp", label: "Medikament Stopp" },
  { value: "arzttermin", label: "Arzttermin" },
  { value: "sonstiges", label: "Sonstiges" },
];

function randomId(): string {
  // crypto.randomUUID() ist in allen relevanten Browsern (inkl. iOS Safari)
  // verfügbar; kein Polyfill nötig für die Zielplattformen aus SPEC.md §4.1.
  return crypto.randomUUID();
}

export function emptyEvent(date: string): JournalEvent {
  return {
    id: randomId(),
    date,
    type: "sonstiges",
    title: "",
    details: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    sync_status: "pending",
  };
}
