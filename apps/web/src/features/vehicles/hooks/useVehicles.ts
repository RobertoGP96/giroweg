"use client";

import { currentOdometer, validReadings } from "@giroweg/shared/domain";
import type { Reading, Vehicle } from "@giroweg/shared/schemas";
import { usePrefs, useStoreVersion } from "@/db/hooks";
import { useAsync } from "@/lib/useAsync";
import { readingsRepository, type ReadingEntry } from "@/features/readings/repository";
import { vehiclesRepository } from "../repository";

export interface VehicleSummary {
  vehicle: Vehicle;
  /** Derived from the readings, never stored (domain rule 4). */
  odometer: number;
  lastReading: Reading | undefined;
  readingCount: number;
}

export interface VehicleDetail extends VehicleSummary {
  /** Newest first, voided included. */
  entries: ReadingEntry[];
}

const summarize = async (vehicle: Vehicle): Promise<VehicleSummary> => {
  const readings = await readingsRepository.listByVehicle(vehicle.id);
  const valid = validReadings(readings);
  return {
    vehicle,
    odometer: currentOdometer(readings, vehicle.initialValue),
    lastReading: valid[valid.length - 1],
    readingCount: valid.length,
  };
};

export const useVehicles = (include: "active" | "archived" = "active") => {
  const version = useStoreVersion();
  return useAsync(async () => {
    const vehicles =
      include === "active" ? await vehiclesRepository.listActive() : await vehiclesRepository.listArchived();
    return Promise.all(vehicles.map(summarize));
  }, [include, version]);
};

export const useVehicle = (id: string) => {
  const version = useStoreVersion();
  return useAsync(async (): Promise<VehicleDetail> => {
    const vehicle = await vehiclesRepository.getById(id);
    if (!vehicle) throw new Error("Vehicle not found");
    const summary = await summarize(vehicle);
    return { ...summary, entries: await readingsRepository.listEntries(id) };
  }, [id, version]);
};

/** The vehicle the user last worked with, or the first one. */
export const useSelectedVehicle = (
  summaries: VehicleSummary[] | undefined,
  requestedId?: string | null,
): VehicleSummary | undefined => {
  const { selectedVehicleId } = usePrefs();
  if (!summaries || summaries.length === 0) return undefined;
  const wanted = requestedId ?? selectedVehicleId;
  return summaries.find((s) => s.vehicle.id === wanted) ?? summaries[0];
};
