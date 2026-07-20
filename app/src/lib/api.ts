import type { DailyEntry } from "./dailyEntry";
import type { WeeklyCheck } from "./weeklyCheck";
import type { Phq9Check } from "./phq9";
import type { JournalEvent } from "./event";

export class UnauthenticatedError extends Error {}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (response.status === 401) {
    throw new UnauthenticatedError();
  }
  return response;
}

export async function login(password: string): Promise<boolean> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return response.ok;
}

// Serverfelder, die nie vom Client gesendet werden (server-seitig verwaltet
// oder rein lokales Bookkeeping, s. lib/sync.ts).
function stripLocalFields<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  const { sync_status: _syncStatus, server_received_at: _serverReceivedAt, ...rest } = record;
  return rest;
}

export async function pushRecord<T extends Record<string, unknown>>(
  table: string,
  record: T,
): Promise<T> {
  const response = await apiFetch("/api/v1/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, records: [stripLocalFields(record)] }),
  });

  if (!response.ok) {
    throw new Error(`Sync-Push fehlgeschlagen (${table}): ${response.status}`);
  }

  const body = await response.json();
  return body.tables[table][0];
}

export async function fetchVapidPublicKey(): Promise<string> {
  const response = await apiFetch("/api/v1/push/vapid-public-key");
  if (!response.ok) {
    throw new Error(`VAPID-Key-Abruf fehlgeschlagen: ${response.status}`);
  }
  const body = await response.json();
  return body.publicKey;
}

export async function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  const response = await apiFetch("/api/v1/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    throw new Error(`Push-Subscribe fehlgeschlagen: ${response.status}`);
  }
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  const response = await apiFetch("/api/v1/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) {
    throw new Error(`Push-Unsubscribe fehlgeschlagen: ${response.status}`);
  }
}

export async function testSendPush(): Promise<void> {
  const response = await apiFetch("/api/v1/push/test-send", { method: "POST" });
  if (!response.ok) {
    throw new Error(`Push-Testversand fehlgeschlagen: ${response.status}`);
  }
}

export interface PullResult {
  since: string;
  daily_entries: DailyEntry[];
  weekly_checks: WeeklyCheck[];
  phq9_checks: Phq9Check[];
  events: JournalEvent[];
}

export async function pullSince(since: string | undefined): Promise<PullResult> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await apiFetch(`/api/v1/sync${query}`);

  if (!response.ok) {
    throw new Error(`Sync-Pull fehlgeschlagen: ${response.status}`);
  }

  const body = await response.json();
  return {
    since: body.since,
    daily_entries: body.tables.daily_entries,
    weekly_checks: body.tables.weekly_checks,
    phq9_checks: body.tables.phq9_checks,
    events: body.tables.events,
  };
}
