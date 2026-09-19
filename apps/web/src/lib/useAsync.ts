"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: Error };

const LOADING: AsyncState<never> = { status: "loading", data: undefined, error: undefined };

/**
 * Minimal async loader for repository reads: loading → success | error, with
 * reload. Screens use it to implement their loading / error states.
 * The result is keyed by the request identity, so a new request shows the
 * loading state without an extra render cycle.
 */
export const useAsync = <T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>) => {
  const [version, setVersion] = useState(0);
  // A fresh identity for every (deps, version) combination.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- deps are provided by the caller
  const request = useMemo(() => ({}), [...deps, version]);
  const [result, setResult] = useState<{ request: object; state: AsyncState<T> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setResult({ request, state: { status: "success", data, error: undefined } });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setResult({ request, state: { status: "error", data: undefined, error } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is captured per request on purpose
  }, [request]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const state: AsyncState<T> = result?.request === request ? result.state : LOADING;

  return { ...state, reload };
};
