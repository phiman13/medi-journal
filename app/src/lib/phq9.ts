// Spiegelt server/src/db/phq9Checks.ts (SPEC.md §3.3).
export interface Phq9Check {
  date: string;
  answers: number[];
  score: number;
  updated_at: string;
  deleted_at: string | null;
  server_received_at?: string;
  sync_status: "pending" | "synced";
}

// Verbindliche Fragetexte, SPEC.md §10. Bezugsrahmen: letzte 2 Wochen.
// Antwortskala 0=überhaupt nicht, 1=an einzelnen Tagen,
// 2=an mehr als der Hälfte der Tage, 3=beinahe jeden Tag.
export const PHQ9_QUESTIONS = [
  "Wenig Interesse oder Freude an Tätigkeiten",
  "Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit",
  "Ein-/Durchschlafprobleme oder vermehrter Schlaf",
  "Müdigkeit oder Gefühl, keine Energie zu haben",
  "Verminderter Appetit oder übermäßiges Essbedürfnis",
  "Schlechte Meinung von sich selbst; Gefühl zu versagen",
  "Konzentrationsschwierigkeiten (z. B. beim Lesen/Fernsehen)",
  "Verlangsamung – oder Gegenteil: rastlose Unruhe",
  "Gedanken, besser tot zu sein oder sich Leid zuzufügen",
] as const;

// Index des sensiblen Items (Suizidgedanken), SPEC.md §3.3.
export const PHQ9_ITEM_9_INDEX = 8;

export function emptyPhq9Check(date: string): Phq9Check {
  return {
    date,
    answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    score: 0,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    sync_status: "pending",
  };
}

// Schweregrade SPEC.md §10, bewusst nur clientseitig berechnet (nicht
// persistiert - aus `score` jederzeit ableitbar, s. server/src/db/phq9Checks.ts).
export function phq9Severity(score: number): string {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderat";
  if (score <= 19) return "mittelgradig schwer";
  return "schwer";
}
