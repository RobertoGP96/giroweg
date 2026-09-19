"use client";

import { useAsync } from "@/lib/useAsync";
import { readingsRepository } from "@/features/readings/repository";
import { vehiclesRepository } from "../repository";

export const useVehicles = () =>
  useAsync(async () => {
    const vehicles = await vehiclesRepository.listActive();
    return Promise.all(
      vehicles.map(async (vehicle) => ({
        vehicle,
        odometer: await readingsRepository.currentValue(vehicle.id),
        status: vehiclesRepository.statusOf(vehicle),
      })),
    );
  }, []);

export const useActiveVehicle = () =>
  useAsync(async () => {
    const vehicle = await vehiclesRepository.getActiveForCurrentUser();
    if (!vehicle) throw new Error("No active vehicle");
    const odometer = await readingsRepository.currentValue(vehicle.id);
    return { vehicle, odometer };
  }, []);
