import type { GpsFix } from "@giroweg/shared/domain";
import { create } from "zustand";
import {
  applyFix,
  freezeTracking,
  pauseTracking,
  resumeTracking,
  setGpsStatus,
  unfreezeTracking,
  type GpsState,
  type TrackingState,
} from "./tracking";

interface TripStoreState {
  /** False until the snapshot has been read (or found empty) on the client. */
  hydrated: boolean;
  tracking: TrackingState | null;
  /** The last snapshot write failed (storage quota): the UI warns the driver. */
  snapshotFailed: boolean;
}

interface TripStoreActions {
  hydrate: (tracking: TrackingState | null) => void;
  begin: (tracking: TrackingState) => void;
  addFix: (fix: GpsFix) => void;
  pause: (nowMs: number) => void;
  resume: (nowMs: number) => void;
  freeze: () => void;
  unfreeze: () => void;
  setGps: (gps: GpsState) => void;
  setSnapshotFailed: (failed: boolean) => void;
  clear: () => void;
}

export type TripStore = TripStoreState & TripStoreActions;

type Reducer = (tracking: TrackingState) => TrackingState;

/**
 * Live state of the trip in progress. Every transition is a pure function from
 * tracking.ts; this store only holds the current value and re-renders the UI.
 * No window access here: the snapshot persister subscribes from the client.
 */
export const useTripStore = create<TripStore>((set) => {
  const update = (reduce: Reducer) =>
    set((state) => {
      if (state.tracking === null) return state;
      const next = reduce(state.tracking);
      return next === state.tracking ? state : { tracking: next };
    });

  return {
    hydrated: false,
    tracking: null,
    snapshotFailed: false,
    hydrate: (tracking) => set({ hydrated: true, tracking }),
    begin: (tracking) => set({ hydrated: true, tracking, snapshotFailed: false }),
    addFix: (fix) => update((tracking) => applyFix(tracking, fix)),
    pause: (nowMs) => update((tracking) => pauseTracking(tracking, nowMs)),
    resume: (nowMs) => update((tracking) => resumeTracking(tracking, nowMs)),
    freeze: () => update(freezeTracking),
    unfreeze: () => update(unfreezeTracking),
    setGps: (gps) => update((tracking) => setGpsStatus(tracking, gps)),
    setSnapshotFailed: (failed) =>
      set((state) => (state.snapshotFailed === failed ? state : { snapshotFailed: failed })),
    clear: () => set({ tracking: null, snapshotFailed: false }),
  };
});
