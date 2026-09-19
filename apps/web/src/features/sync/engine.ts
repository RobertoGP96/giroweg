"use client";

import type { Reading, Vehicle } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import type { OutboxEntry, TableName } from "@/db/store";
import { nowIso } from "@/lib/id";
import { apiFetch } from "./api";
import { useSyncStatus } from "./store";

/**
 * Sync engine: pushes the outbox in order with retries and backoff (upsert
 * idempotent by id on the server) and pulls the organization's data back.
 * Only this module talks to the server to write data.
 */

interface PullResponse {
  userId: string;
  organizationId: string;
  serverTime: string;
  vehicles: Vehicle[];
  readings: Reading[];
}

interface PushResult {
  table: TableName;
  id: string;
  ok: boolean;
  syncedAt: string | null;
  error: string | null;
  permanent: boolean;
}

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;
const PERMANENT_DELAY_MS = 30 * 60_000;

const retryAt =
  (permanent: boolean) =>
  (attempts: number): string => {
    const delay = permanent ? PERMANENT_DELAY_MS : Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
    return new Date(Date.now() + delay).toISOString();
  };

export const isDue = (entry: OutboxEntry, now: number = Date.now()): boolean =>
  entry.nextAttemptAt === null || new Date(entry.nextAttemptAt).getTime() <= now;

const uniqueIds = (entries: OutboxEntry[], table: TableName): string[] => [
  ...new Set(entries.filter((entry) => entry.table === table).map((entry) => entry.recordId)),
];

/** Sends every due outbox entry, latest state of each record, vehicles first. */
export const pushOutbox = async (): Promise<void> => {
  const store = getStore();
  const due = store.outbox.filter((entry) => isDue(entry));
  if (due.length === 0) return;

  const vehicles = uniqueIds(due, "vehicles")
    .map((id) => store.table("vehicles").find((row) => row.id === id))
    .filter((row): row is Vehicle => row !== undefined);
  const readings = uniqueIds(due, "readings")
    .map((id) => store.table("readings").find((row) => row.id === id))
    .filter((row): row is Reading => row !== undefined);

  let results: PushResult[];
  try {
    const response = await apiFetch("/api/sync", { method: "POST", body: JSON.stringify({ vehicles, readings }) });
    if (!response.ok) throw new Error(`push_failed_${response.status}`);
    results = ((await response.json()) as { results: PushResult[] }).results;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    store.failOutbox(
      due.map((entry) => entry.id),
      message,
      retryAt(false),
    );
    throw cause;
  }

  for (const result of results) {
    const entries = due.filter((entry) => entry.table === result.table && entry.recordId === result.id);
    const ids = entries.map((entry) => entry.id);
    if (result.ok && result.syncedAt) {
      store.markSynced(result.table, result.id, result.syncedAt);
      store.ackOutbox(ids);
    } else {
      store.failOutbox(ids, result.error ?? "rejected", retryAt(result.permanent));
    }
  }
};

/** Replaces the local tables with the server's, keeping unsynced local rows. */
export const pullRemote = async (): Promise<void> => {
  const store = getStore();
  let response = await apiFetch("/api/sync");
  if (response.status === 409) {
    // The account has no organization yet (older sign-up): create it and retry.
    await apiFetch("/api/onboarding", { method: "POST" });
    response = await apiFetch("/api/sync");
  }
  if (!response.ok) throw new Error(`pull_failed_${response.status}`);
  const data = (await response.json()) as PullResponse;

  // Another account signed in on this device: never mix their data.
  if (store.session && store.session.userId !== data.userId) store.reset();
  store.setSession({ userId: data.userId, orgId: data.organizationId });
  store.applyRemote({ vehicles: data.vehicles, readings: data.readings }, { replace: true });
  store.setPulledAt(data.serverTime);
};

let inFlight: Promise<void> | null = null;
let queued = false;

const run = async (): Promise<void> => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  useSyncStatus.setState({ syncing: true });
  try {
    let pushError: string | null = null;
    try {
      await pushOutbox();
    } catch (cause) {
      pushError = cause instanceof Error ? cause.message : String(cause);
    }
    await pullRemote();
    useSyncStatus.setState({ lastSyncAt: nowIso(), lastError: pushError });
  } catch (cause) {
    useSyncStatus.setState({ lastError: cause instanceof Error ? cause.message : String(cause) });
  } finally {
    useSyncStatus.setState({ syncing: false });
  }
};

/** Push then pull, one cycle at a time; a call during a cycle schedules another. */
export const syncNow = (): Promise<void> => {
  if (inFlight) {
    queued = true;
    return inFlight;
  }
  inFlight = run().finally(() => {
    inFlight = null;
    if (queued) {
      queued = false;
      void syncNow();
    }
  });
  return inFlight;
};

/** Manual retry from the UI: clears backoff and syncs. */
export const retryNow = (): Promise<void> => {
  getStore().retryOutbox();
  return syncNow();
};
