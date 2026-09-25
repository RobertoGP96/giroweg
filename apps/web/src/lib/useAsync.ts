"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ensureLoaded, LOADING, readCache, stampOf, subscribeCache, type AsyncState } from "./asyncCache";

export type { AsyncState } from "./asyncCache";

/**
 * Loader for repository reads: loading → success | error, with reload.
 * Results live in the shared asyncCache under `key`, so a screen that comes
 * back (tab switch, back navigation) or whose data another screen already
 * loaded renders with content on its first frame. When `deps` change
 * (typically the local store version) the last data stays visible while the
 * fresh load runs, so local writes and syncs never flash a skeleton.
 */
export const useAsync = <T>(key: string, load: () => Promise<T>, deps: ReadonlyArray<unknown>) => {
  const stamp = stampOf(deps);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const subscribe = useCallback((listener: () => void) => subscribeCache(key, listener), [key]);
  const entry = useSyncExternalStore(subscribe, () => readCache<T>(key), () => null);

  // `missing` re-runs the effect when the cache is cleared while mounted.
  const missing = entry === null;
  useEffect(() => {
    void ensureLoaded(key, stamp, () => loadRef.current());
  }, [key, stamp, missing]);

  const reload = useCallback(() => {
    void ensureLoaded(key, stamp, () => loadRef.current(), { force: true });
  }, [key, stamp]);

  const state: AsyncState<T> =
    entry === null ? LOADING : entry.stamp === stamp || entry.state.status === "success" ? entry.state : LOADING;

  return { ...state, reload };
};
