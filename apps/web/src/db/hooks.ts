"use client";

import { useSyncExternalStore } from "react";
import { getStore } from "./client";
import type { LocalSession, Preferences } from "./store";

const subscribe = (callback: () => void) => getStore().subscribe(callback);
const EMPTY_PREFS: Preferences = { selectedVehicleId: null };

/** Changes on every local write or sync; put it in the deps of data hooks. */
export const useStoreVersion = (): number =>
  useSyncExternalStore(subscribe, () => getStore().version, () => 0);

export const useLocalSession = (): LocalSession | null =>
  useSyncExternalStore(subscribe, () => getStore().session, () => null);

export const usePrefs = (): Preferences =>
  useSyncExternalStore(subscribe, () => getStore().prefs, () => EMPTY_PREFS);
