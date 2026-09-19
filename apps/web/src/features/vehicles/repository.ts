import type { Vehicle } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import { currentUser } from "@/db/seed";

export type VehicleStatus = "onRoute" | "workshop" | "idle";

/** Derived, not stored: workshop is a placeholder until maintenance events carry it. */
const STATUS_BY_PLATE: Record<string, VehicleStatus> = {
  "MTR-482": "onRoute",
  "VAN-207": "workshop",
  "BK-014": "idle",
};

export const vehiclesRepository = {
  async listActive(): Promise<Vehicle[]> {
    return getStore()
      .table("vehicles")
      .filter((v) => v.archivedAt === null);
  },

  async getById(id: string): Promise<Vehicle | undefined> {
    return getStore()
      .table("vehicles")
      .find((v) => v.id === id);
  },

  async getActiveForCurrentUser(): Promise<Vehicle | undefined> {
    return this.getById(currentUser.activeVehicleId);
  },

  statusOf(vehicle: Vehicle): VehicleStatus {
    return (vehicle.plate && STATUS_BY_PLATE[vehicle.plate]) || "idle";
  },
};
