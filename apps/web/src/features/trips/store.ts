"use client";

import { create } from "zustand";

export type ShiftStep = "idle" | "starting" | "trip" | "ending";

interface ShiftState {
  step: ShiftStep;
  vehicleId: string | null;
  /** Odometer confirmed by the driver at the start. */
  startValue: number | null;
  startReadingId: string | null;
  startedAt: string | null;
  /** Distance measured during the trip, in the vehicle unit. */
  gpsDistance: number;
  elapsedSeconds: number;
  stops: number;
  paused: boolean;
  pauses: number;
  pausedSeconds: number;
  /** Km/h from the tracker; 0 while paused. */
  speed: number;
}

interface ShiftActions {
  beginStart: (vehicleId: string) => void;
  confirmStart: (input: { startValue: number; startReadingId: string; startedAt: string }) => void;
  tick: () => void;
  addDistance: (delta: number, speed: number) => void;
  addStop: () => void;
  togglePause: () => void;
  beginEnd: () => void;
  backToTrip: () => void;
  reset: () => void;
}

const initial: ShiftState = {
  step: "idle",
  vehicleId: null,
  startValue: null,
  startReadingId: null,
  startedAt: null,
  gpsDistance: 0,
  elapsedSeconds: 0,
  stops: 0,
  paused: false,
  pauses: 0,
  pausedSeconds: 0,
  speed: 0,
};

/** UI state of the shift in progress (start → trip → end). Persisted data lives in repositories. */
export const useShiftStore = create<ShiftState & ShiftActions>((set) => ({
  ...initial,
  beginStart: (vehicleId) => set({ ...initial, step: "starting", vehicleId }),
  confirmStart: ({ startValue, startReadingId, startedAt }) =>
    set({ step: "trip", startValue, startReadingId, startedAt }),
  tick: () =>
    set((s) =>
      s.paused
        ? { pausedSeconds: s.pausedSeconds + 1 }
        : { elapsedSeconds: s.elapsedSeconds + 1 },
    ),
  addDistance: (delta, speed) =>
    set((s) => (s.paused ? {} : { gpsDistance: s.gpsDistance + Math.max(delta, 0), speed })),
  addStop: () => set((s) => ({ stops: s.stops + 1 })),
  togglePause: () =>
    set((s) => ({ paused: !s.paused, pauses: s.paused ? s.pauses : s.pauses + 1, speed: 0 })),
  beginEnd: () => set({ step: "ending", paused: false, speed: 0 }),
  backToTrip: () => set({ step: "trip" }),
  reset: () => set(initial),
}));
