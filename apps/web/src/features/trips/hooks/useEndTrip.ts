"use client";

import type { TripEndInput } from "@giroweg/shared/schemas";
import { useCallback } from "react";
import { syncNow } from "@/features/sync/engine";
import { tripsRepository } from "../repository";

/** Longest the end of a trip waits for a sync before validating locally. */
const SYNC_WAIT_MS = 4000;

const syncBriefly = (): Promise<void> =>
  new Promise((resolve) => {
    const timer = window.setTimeout(resolve, SYNC_WAIT_MS);
    syncNow()
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timer);
        resolve();
      });
  });

type EndResult = Awaited<ReturnType<typeof tripsRepository.end>>;

/**
 * Ends a trip. When online it first gives a sync a few seconds so the local
 * rule-2 validation sees readings added from other devices; offline, or if
 * the sync is slow, the local data decides and the server re-validates later.
 */
export const useEndTrip = () => {
  const end = useCallback(async (input: TripEndInput): Promise<EndResult> => {
    if (navigator.onLine) await syncBriefly();
    return tripsRepository.end(input);
  }, []);

  return { end };
};
