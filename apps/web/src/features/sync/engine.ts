"use client";

import { getStore } from "@/db/client";
import type { LocalStore, OutboxEntry, TableName, Tables } from "@/db/store";
import { clearTripSnapshot } from "@/features/trips/snapshot";
import { nowIso } from "@/lib/id";
import { apiFetch } from "./api";
import {
  DEPENDENCY_REJECTED,
  MAX_ROUTES_PER_PUSH,
  type PullResponse,
  type PushPayload,
  type PushResult,
} from "./protocol";
import { useSyncStatus } from "./store";

/**
 * Sync engine: pushes the outbox in order with retries and backoff (upsert
 * idempotent by id on the server) and pulls the organization's data back.
 * Only this module talks to the server to write data.
 */

type Row<K extends TableName> = Tables[K][number];

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

export interface PushPlan {
  payload: PushPayload;
  /** The outbox entries the payload covers; anything else stays due and untouched. */
  sent: OutboxEntry[];
}

/**
 * Latest local row of every due record of one table, in outbox order, at
 * most `limit` distinct records. Entries whose record no longer exists
 * locally are not sent.
 */
const rowsFor = <K extends TableName>(
  store: LocalStore,
  due: readonly OutboxEntry[],
  table: K,
  limit = Number.POSITIVE_INFINITY,
): { rows: Row<K>[]; entries: OutboxEntry[] } => {
  const ids = [...new Set(due.filter((entry) => entry.table === table).map((entry) => entry.recordId))];
  const rows: Row<K>[] = [];
  const included = new Set<string>();
  for (const id of ids) {
    if (rows.length >= limit) break;
    const row = store.table(table).find((candidate) => candidate.id === id);
    if (!row) continue;
    rows.push(row);
    included.add(id);
  }
  const entries = due.filter((entry) => entry.table === table && included.has(entry.recordId));
  return { rows, entries };
};

/**
 * What the next push carries: the latest state of each due record, parents
 * first. Routes are heavy, so only the first `MAX_ROUTES_PER_PUSH` go; the
 * rest wait for the following cycle. Pure: reads the store, writes nothing.
 */
export const planPush = (store: LocalStore, now: number = Date.now()): PushPlan => {
  const due = store.outbox.filter((entry) => isDue(entry, now));
  const vehicles = rowsFor(store, due, "vehicles");
  const readings = rowsFor(store, due, "readings");
  const trips = rowsFor(store, due, "trips");
  const tripRoutes = rowsFor(store, due, "tripRoutes", MAX_ROUTES_PER_PUSH);
  return {
    payload: {
      vehicles: vehicles.rows,
      readings: readings.rows,
      trips: trips.rows,
      tripRoutes: tripRoutes.rows,
    },
    sent: [...vehicles.entries, ...readings.entries, ...trips.entries, ...tripRoutes.entries],
  };
};

/**
 * A trip or route rejected because its parent is not on the server yet: the
 * database said so (foreign key), or the parent was rejected in this very
 * batch. Such a record only makes sense to retry once the parent gets through.
 */
const isDependencyFailure = (
  store: LocalStore,
  result: PushResult,
  rejectedReadings: ReadonlySet<string>,
  rejectedTrips: ReadonlySet<string>,
): boolean => {
  if (result.table !== "trips" && result.table !== "tripRoutes") return false;
  if (result.error === "foreign_key_violation") return true;
  if (result.table === "trips") {
    const trip = store.table("trips").find((row) => row.id === result.id);
    if (!trip) return false;
    return (
      rejectedReadings.has(trip.startReadingId) ||
      (trip.endReadingId !== null && rejectedReadings.has(trip.endReadingId))
    );
  }
  const route = store.table("tripRoutes").find((row) => row.id === result.id);
  return route !== undefined && rejectedTrips.has(route.tripId);
};

/**
 * Applies the server's verdicts to the outbox: accepted records are stamped
 * and every entry of theirs dropped; rejected ones back off with the server
 * error, or wait as `dependency_rejected` when their parent failed. Once a
 * reading or trip gets through, waiting dependents become due again.
 */
export const settleResults = (store: LocalStore, sent: readonly OutboxEntry[], results: readonly PushResult[]): void => {
  const rejectedIds = (table: TableName): ReadonlySet<string> =>
    new Set(results.filter((result) => result.table === table && !result.ok).map((result) => result.id));
  const rejectedReadings = rejectedIds("readings");
  const rejectedTrips = rejectedIds("trips");
  let parentAccepted = false;

  for (const result of results) {
    const ids = sent
      .filter((entry) => entry.table === result.table && entry.recordId === result.id)
      .map((entry) => entry.id);
    if (result.ok && result.syncedAt) {
      store.markSynced(result.table, result.id, result.syncedAt);
      store.ackRecord(result.table, result.id);
      if (result.table === "readings" || result.table === "trips") parentAccepted = true;
      continue;
    }
    if (isDependencyFailure(store, result, rejectedReadings, rejectedTrips)) {
      store.failOutbox(ids, DEPENDENCY_REJECTED, retryAt(true));
    } else {
      store.failOutbox(ids, result.error ?? "rejected", retryAt(result.permanent));
    }
  }

  if (parentAccepted) store.retryOutbox({ errors: [DEPENDENCY_REJECTED] });
};

/** Sends every due outbox entry, latest state of each record, parents first. */
export const pushOutbox = async (): Promise<void> => {
  const store = getStore();
  const { payload, sent } = planPush(store);
  if (sent.length === 0) return;

  let results: PushResult[];
  try {
    const response = await apiFetch("/api/sync", { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`push_failed_${response.status}`);
    results = ((await response.json()) as { results: PushResult[] }).results;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    store.failOutbox(
      sent.map((entry) => entry.id),
      message,
      retryAt(false),
    );
    throw cause;
  }

  settleResults(store, sent, results);
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

  // Another account signed in on this device: never mix their data, not even a trip in progress.
  if (store.session && store.session.userId !== data.userId) {
    store.reset();
    clearTripSnapshot();
  }
  store.setSession({ userId: data.userId, orgId: data.organizationId });
  store.applyRemote({ vehicles: data.vehicles, readings: data.readings, trips: data.trips }, { replace: true });
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
