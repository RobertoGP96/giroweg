"use client";

import { useEffect, useState } from "react";
import { useTripStore } from "../store";
import { elapsedSeconds, type TrackingState } from "../tracking";

export interface ActiveTrip {
  /** False until the snapshot has been read on the client. */
  hydrated: boolean;
  tracking: TrackingState | null;
  snapshotFailed: boolean;
  /** Seconds of the trip so far, pauses excluded; ticks once a second. */
  elapsed: number;
  paused: boolean;
}

/** The trip in progress with a live clock, for the home card and the trip screen. */
export const useActiveTrip = (): ActiveTrip => {
  const hydrated = useTripStore((state) => state.hydrated);
  const tracking = useTripStore((state) => state.tracking);
  const snapshotFailed = useTripStore((state) => state.snapshotFailed);
  // The clock lives in state so the render stays pure; the interval advances it.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const running = tracking !== null;

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  return {
    hydrated,
    tracking,
    snapshotFailed,
    elapsed: tracking === null ? 0 : elapsedSeconds(tracking, nowMs),
    paused: tracking?.status === "paused",
  };
};
