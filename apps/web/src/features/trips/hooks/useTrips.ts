"use client";

import { useStoreVersion } from "@/db/hooks";
import { useAsync } from "@/lib/useAsync";
import { tripsRepository, type TripSummary } from "../repository";

const loadTrips = (vehicleId: string | undefined): Promise<TripSummary[]> =>
  vehicleId === undefined ? tripsRepository.listAll() : tripsRepository.listByVehicle(vehicleId);

/** Trips of one vehicle, or of every vehicle when no id is given (open first, then newest). */
export const useTrips = (vehicleId: string | undefined) => {
  const version = useStoreVersion();
  return useAsync(`trips:${vehicleId ?? "all"}`, () => loadTrips(vehicleId), [version]);
};

/** One trip with its readings and vehicle; `data` is undefined when it does not exist locally. */
export const useTrip = (tripId: string) => {
  const version = useStoreVersion();
  return useAsync(`trip:${tripId}`, () => tripsRepository.getById(tripId), [version]);
};
