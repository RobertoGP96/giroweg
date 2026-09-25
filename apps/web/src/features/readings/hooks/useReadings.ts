"use client";

import type { Reading, Vehicle } from "@giroweg/shared/schemas";
import { storeVersion, useStoreVersion } from "@/db/hooks";
import { primeAsync } from "@/lib/asyncCache";
import { useAsync } from "@/lib/useAsync";
import { vehiclesRepository } from "@/features/vehicles/repository";
import { readingsRepository, type ReadingEntry, type VehicleStats } from "../repository";

const EMPTY_STATS: VehicleStats = { monthDistance: 0, monthReadings: 0, weekDistance: 0, days: [] };

const readingsKey = (vehicleId: string | undefined) => `readings:${vehicleId ?? "none"}`;
const readingKey = (readingId: string) => `reading:${readingId}`;
const statsKey = (vehicleId: string | undefined) => `stats:${vehicleId ?? "none"}`;

const loadReadings = async (vehicleId: string | undefined): Promise<ReadingEntry[]> =>
  vehicleId ? readingsRepository.listEntries(vehicleId) : [];

export const useReadings = (vehicleId: string | undefined) => {
  const version = useStoreVersion();
  return useAsync(readingsKey(vehicleId), () => loadReadings(vehicleId), [version]);
};

export interface ReadingDetail {
  reading: Reading;
  vehicle: Vehicle | undefined;
  delta: number | null;
}

const loadReading = async (readingId: string): Promise<ReadingDetail> => {
  const reading = await readingsRepository.getById(readingId);
  if (!reading) throw new Error("Reading not found");
  const [vehicle, entries] = await Promise.all([
    vehiclesRepository.getById(reading.vehicleId),
    readingsRepository.listEntries(reading.vehicleId),
  ]);
  return { reading, vehicle, delta: entries.find((entry) => entry.reading.id === readingId)?.delta ?? null };
};

export const useReading = (readingId: string) => {
  const version = useStoreVersion();
  return useAsync(readingKey(readingId), () => loadReading(readingId), [version]);
};

/** Warms a reading's detail (on press) so it opens with content on its first frame. */
export const primeReading = (readingId: string): void => {
  primeAsync(readingKey(readingId), () => loadReading(readingId), [storeVersion()]);
};

const loadStats = async (vehicleId: string | undefined): Promise<VehicleStats> =>
  vehicleId ? readingsRepository.stats(vehicleId) : EMPTY_STATS;

export const useVehicleStats = (vehicleId: string | undefined) => {
  const version = useStoreVersion();
  return useAsync(statsKey(vehicleId), () => loadStats(vehicleId), [version]);
};

export const primeVehicleStats = (vehicleId: string): void => {
  primeAsync(statsKey(vehicleId), () => loadStats(vehicleId), [storeVersion()]);
};
