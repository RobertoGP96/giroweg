"use client";

import { useSyncExternalStore } from "react";

export type GeolocationPermission = "granted" | "denied" | "prompt" | "unknown";

/*
 * Module-level cache of the PermissionStatus so the snapshot is synchronous
 * and stable between renders, as useSyncExternalStore requires. The query
 * itself is asynchronous: subscribers are notified once it resolves.
 */
let status: PermissionStatus | null = null;
let queried = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const query = () => {
  if (queried) return;
  queried = true;
  try {
    if (!("permissions" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        status = result;
        result.addEventListener("change", notify);
        notify();
      })
      .catch(() => {
        // Unsupported descriptor or blocked API: stays "unknown".
      });
  } catch {
    // Same: the hook reports "unknown".
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  query();
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): GeolocationPermission => {
  if (status === null) return "unknown";
  return status.state;
};

const getServerSnapshot = (): GeolocationPermission => "unknown";

/** Current geolocation permission, live via the Permissions API; "unknown" when unavailable. */
export const useGeolocationPermission = (): GeolocationPermission =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
