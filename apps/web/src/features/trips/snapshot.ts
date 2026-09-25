/**
 * Persists the trip in progress so a reload, a crash or a tab discard does
 * not lose the route. The snapshot lives in localStorage under one key and
 * is validated on the way back in; anything unreadable counts as no trip.
 */

import type { useTripStore } from "./store";
import { trackingStateSchema, type TrackingState } from "./tracking";

export const ACTIVE_TRIP_KEY = "giroweg.trip.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The stored trip, or null when there is none or it does not parse. */
export const loadTripSnapshot = (storage: StorageLike | null = defaultStorage()): TrackingState | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_TRIP_KEY);
    if (raw === null) return null;
    const parsed = trackingStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** Writes (or removes, for null) the snapshot. Throws when the storage rejects the write. */
export const saveTripSnapshot = (
  tracking: TrackingState | null,
  storage: StorageLike | null = defaultStorage(),
): void => {
  if (!storage) return;
  if (tracking === null) {
    storage.removeItem(ACTIVE_TRIP_KEY);
    return;
  }
  storage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(tracking));
};

export const clearTripSnapshot = (storage: StorageLike | null = defaultStorage()): void => {
  try {
    storage?.removeItem(ACTIVE_TRIP_KEY);
  } catch {
    // Nothing to clear when the storage is unavailable.
  }
};

type TimerId = ReturnType<typeof setTimeout>;

export interface SnapshotPersisterOptions {
  storage?: StorageLike | null;
  /** Trailing delay for fix-only updates; status and trip changes write at once. */
  throttleMs?: number;
  setTimeout?: (callback: () => void, ms: number) => TimerId;
  clearTimeout?: (id: TimerId) => void;
}

const DEFAULT_THROTTLE_MS = 5000;

/** Whether the change needs to hit the disk right away. */
const isUrgent = (next: TrackingState | null, previous: TrackingState | null): boolean =>
  next === null ||
  previous === null ||
  next.status !== previous.status ||
  next.tripId !== previous.tripId;

/**
 * Keeps the snapshot in step with the store: immediate writes when the trip
 * starts, ends or changes status, a trailing throttle for the stream of
 * fixes, and a flush when the page is hidden or about to unload. Quota
 * errors flag `snapshotFailed` on the store; the next success clears it.
 * Returns a function that stops the persister.
 */
export const startSnapshotPersister = (
  store: typeof useTripStore,
  options: SnapshotPersisterOptions = {},
): (() => void) => {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const schedule = options.setTimeout ?? ((callback, ms) => setTimeout(callback, ms));
  const cancel = options.clearTimeout ?? ((id) => clearTimeout(id));

  let timer: TimerId | null = null;
  let dirty = false;

  const write = () => {
    dirty = false;
    try {
      saveTripSnapshot(store.getState().tracking, storage);
      store.getState().setSnapshotFailed(false);
    } catch {
      store.getState().setSnapshotFailed(true);
    }
  };

  const flush = () => {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    if (dirty) write();
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.tracking === previous.tracking) return;
    dirty = true;
    if (isUrgent(state.tracking, previous.tracking)) {
      flush();
      return;
    }
    if (timer === null) {
      timer = schedule(() => {
        timer = null;
        if (dirty) write();
      }, throttleMs);
    }
  });

  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const hasWindow = typeof window !== "undefined";
  if (hasWindow) {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    unsubscribe();
    if (hasWindow) {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    }
    flush();
  };
};
