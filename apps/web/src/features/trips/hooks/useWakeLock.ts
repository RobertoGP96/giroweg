"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getWakeLockState,
  releaseWakeLock,
  requestWakeLock,
  subscribeWakeLock,
  type WakeLockState,
} from "../wakeLock";

const serverSnapshot = (): WakeLockState => "unsupported";

/**
 * Holds the screen wake lock while `wanted`. The browser drops the lock when
 * the tab is hidden, so it is requested again when the page becomes visible.
 */
export const useWakeLock = (wanted: boolean): { state: WakeLockState; retry: () => Promise<void> } => {
  const state = useSyncExternalStore(subscribeWakeLock, getWakeLockState, serverSnapshot);

  useEffect(() => {
    if (!wanted) {
      void releaseWakeLock();
      return;
    }
    const acquire = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void releaseWakeLock();
    };
  }, [wanted]);

  const retry = useCallback(async () => {
    await requestWakeLock();
  }, []);

  return { state, retry };
};
