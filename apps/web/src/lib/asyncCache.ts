/**
 * Shared, in-memory results of repository reads, keyed by query. Screens read
 * it synchronously (useAsync), so a screen visited before, or whose data
 * another screen already loaded, renders with content on its first frame
 * instead of flashing a skeleton. A stale result stays visible while a fresh
 * load runs (stale-while-revalidate); errors are never reused as stale data.
 */

export type AsyncState<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: Error };

export interface CacheEntry<T> {
  state: AsyncState<T>;
  /** Identifies the inputs the state was computed from (see stampOf). */
  stamp: string;
}

interface Inflight {
  stamp: string;
  token: object;
  done: Promise<void>;
}

interface Slot {
  entry: CacheEntry<unknown> | null;
  inflight: Inflight | null;
  listeners: Set<() => void>;
}

export const LOADING: AsyncState<never> = { status: "loading", data: undefined, error: undefined };

const slots = new Map<string, Slot>();

const slotOf = (key: string): Slot => {
  let slot = slots.get(key);
  if (!slot) {
    slot = { entry: null, inflight: null, listeners: new Set() };
    slots.set(key, slot);
  }
  return slot;
};

/** Serializes the inputs of a query; only primitives are expected. */
export const stampOf = (deps: ReadonlyArray<unknown>): string =>
  deps.map((dep) => JSON.stringify(dep) ?? "undefined").join("|");

const toError = (cause: unknown): Error => (cause instanceof Error ? cause : new Error(String(cause)));

/** Snapshot of a query; the same object is returned until it changes. */
export const readCache = <T>(key: string): CacheEntry<T> | null => {
  const entry = slots.get(key)?.entry ?? null;
  // The cache is untyped by design: the caller that wrote the entry with this
  // key is the one reading it back with the same T.
  return entry as CacheEntry<T> | null;
};

/** Notified whenever the entry for `key` changes. */
export const subscribeCache = (key: string, listener: () => void): (() => void) => {
  const slot = slotOf(key);
  slot.listeners.add(listener);
  return () => {
    slot.listeners.delete(listener);
  };
};

const commit = (slot: Slot, entry: CacheEntry<unknown>): void => {
  slot.entry = entry;
  for (const listener of slot.listeners) listener();
};

/**
 * Loads a query unless the cache already holds a settled result for this
 * stamp or the same load is in flight. `force` reloads regardless (retry).
 */
export const ensureLoaded = <T>(
  key: string,
  stamp: string,
  load: () => Promise<T>,
  options: { force?: boolean } = {},
): Promise<void> => {
  const slot = slotOf(key);
  if (!options.force) {
    if (slot.entry?.stamp === stamp) return Promise.resolve();
    if (slot.inflight?.stamp === stamp) return slot.inflight.done;
  }
  const token = {};
  // The load starts now (not in a microtask) so priming on press is as early as possible.
  let started: Promise<T>;
  try {
    started = load();
  } catch (cause: unknown) {
    started = Promise.reject(toError(cause));
  }
  const done = started
    .then<AsyncState<T>, AsyncState<T>>(
      (data) => ({ status: "success", data, error: undefined }),
      (cause: unknown) => ({ status: "error", data: undefined, error: toError(cause) }),
    )
    .then((state) => {
      // A newer load for this key superseded us: keep its result instead.
      if (slot.inflight?.token !== token) return;
      slot.inflight = null;
      commit(slot, { state, stamp });
    });
  slot.inflight = { stamp, token, done };
  return done;
};

/** Warms a query ahead of the screen that needs it (e.g. on press). */
export const primeAsync = <T>(key: string, load: () => Promise<T>, deps: ReadonlyArray<unknown>): void => {
  void ensureLoaded(key, stampOf(deps), load);
};

/** Drops every result, e.g. when the local data belongs to another account. */
export const clearAsyncCache = (): void => {
  for (const slot of slots.values()) {
    slot.inflight = null;
    if (slot.entry !== null) {
      slot.entry = null;
      for (const listener of slot.listeners) listener();
    }
  }
};
