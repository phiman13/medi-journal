import type { DailyEntry } from "./dailyEntry";

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
// oder rein lokales Bookkeeping, s. lib/dailyEntry.ts).
function stripLocalFields(
  entry: DailyEntry,
): Omit<DailyEntry, "sync_status" | "server_received_at"> {
  const { sync_status: _syncStatus, server_received_at: _serverReceivedAt, ...rest } = entry;
  return rest;
}

export async function pushDailyEntry(entry: DailyEntry): Promise<DailyEntry> {
  const response = await apiFetch("/api/v1/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "daily_entries", records: [stripLocalFields(entry)] }),
  });

  if (!response.ok) {
    throw new Error(`Sync-Push fehlgeschlagen: ${response.status}`);
  }

  const body = await response.json();
  return body.tables.daily_entries[0];
}

export interface PullResult {
  since: string;
  records: DailyEntry[];
}

export async function pullDailyEntries(since: string | undefined): Promise<PullResult> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await apiFetch(`/api/v1/sync${query}`);

  if (!response.ok) {
    throw new Error(`Sync-Pull fehlgeschlagen: ${response.status}`);
  }

  const body = await response.json();
  return { since: body.since, records: body.tables.daily_entries };
}
