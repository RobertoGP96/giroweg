"use client";

import type { Reading, Vehicle } from "@giroweg/shared/schemas";
import { useStoreVersion } from "@/db/hooks";
import { useAsync } from "@/lib/useAsync";
import { vehiclesRepository } from "@/features/vehicles/repository";
import { readingsRepository, type ReadingEntry, type VehicleStats } from "../repository";

const EMPTY_STATS: VehicleStats = { monthDistance: 0, monthReadings: 0, weekDistance: 0, days: [] };

export const useReadings = (vehicleId: string | undefined) => {
  const version = useStoreVersion();
  return useAsync(
    async (): Promise<ReadingEntry[]> => (vehicleId ? readingsRepository.listEntries(vehicleId) : []),
    [vehicleId, version],
  );
};

export interface ReadingDetail {
  reading: Reading;
  vehicle: Vehicle | undefined;
  delta: number | null;
}

export const useReading = (readingId: string) => {
  const version = useStoreVersion();
  return useAsync(async (): Promise<ReadingDetail> => {
    const reading = await readingsRepository.getById(readingId);
    if (!reading) throw new Error("Reading not found");
    const [vehicle, entries] = await Promise.all([
      vehiclesRepository.getById(reading.vehicleId),
      readingsRepository.listEntries(reading.vehicleId),
    ]);
    return { reading, vehicle, delta: entries.find((entry) => entry.reading.id === readingId)?.delta ?? null };
  }, [readingId, version]);
};

export const useVehicleStats = (vehicleId: string | undefined) => {
  const version = useStoreVersion();
  return useAsync(
    async (): Promise<VehicleStats> => (vehicleId ? readingsRepository.stats(vehicleId) : EMPTY_STATS),
    [vehicleId, version],
  );
};
