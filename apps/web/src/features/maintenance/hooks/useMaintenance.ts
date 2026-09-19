"use client";

import { useAsync } from "@/lib/useAsync";
import { maintenanceRepository } from "../repository";

export const useMaintenance = (vehicleId: string | undefined) =>
  useAsync(
    async () => (vehicleId ? maintenanceRepository.listByVehicle(vehicleId) : { current: 0, items: [] }),
    [vehicleId],
  );
