"use client";

import { isDistanceUnit } from "@giroweg/shared/domain";
import { useEffect } from "react";
import { getStore } from "@/db/client";
import { useLocalSession } from "@/db/hooks";
import { vehiclesRepository } from "@/features/vehicles/repository";
import { tripsRepository } from "./repository";
import { clearTripSnapshot, loadTripSnapshot, startSnapshotPersister } from "./snapshot";
import { useTripStore } from "./store";
import { startTracking, type TrackingState } from "./tracking";

/**
 * Rebuilds the trip in progress from what the device has: the snapshot when
 * it belongs to the open trip, else a fresh tracking state from the trip row
 * (route lost, distance restarts). No open trip means no tracking.
 */
const restoreTracking = async (): Promise<TrackingState | null> => {
  const open = await tripsRepository.findOpen();
  if (!open) return null;
  const start = getStore()
    .table("readings")
    .find((reading) => reading.id === open.startReadingId);
  if (!start) return null;

  const snapshot = loadTripSnapshot();
  if (snapshot && snapshot.tripId === open.id) return snapshot;

  const vehicle = await vehiclesRepository.getById(open.vehicleId);
  if (!vehicle || !isDistanceUnit(vehicle.unit)) return null;
  return startTracking({
    tripId: open.id,
    vehicleId: open.vehicleId,
    unit: vehicle.unit,
    startReadingId: start.id,
    startValue: start.value,
    startedAt: open.startedAt,
    startedAtMs: Date.parse(open.startedAt),
  });
};

/**
 * Hydrates the trip store after mount (never during SSR) and keeps the
 * snapshot in step with it. Runs again when another user signs in on this
 * device. Renders nothing.
 */
export function TripBoot() {
  const session = useLocalSession();
  const userId = session?.userId ?? null;

  useEffect(() => {
    let cancelled = false;
    void restoreTracking().then((tracking) => {
      if (cancelled) return;
      if (tracking === null) clearTripSnapshot();
      useTripStore.getState().hydrate(tracking);
    });
    const stop = startSnapshotPersister(useTripStore);
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId]);

  return null;
}
