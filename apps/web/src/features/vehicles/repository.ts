import { canChangeUnit } from "@giroweg/shared/domain";
import { vehicleInputSchema, type Vehicle, type VehicleInput } from "@giroweg/shared/schemas";
import { getStore, requireSession } from "@/db/client";
import { nowIso, uuidv7 } from "@/lib/id";

/** Domain rule 3: the unit is immutable once the vehicle has a reading. */
export class UnitLockedError extends Error {
  constructor() {
    super("The unit cannot change once the vehicle has readings");
    this.name = "UnitLockedError";
  }
}

export class VehicleNotFoundError extends Error {
  constructor(id: string) {
    super(`Vehicle not found: ${id}`);
    this.name = "VehicleNotFoundError";
  }
}

const byName = (a: Vehicle, b: Vehicle): number => a.name.localeCompare(b.name, "es");

const getOrThrow = (id: string): Vehicle => {
  const vehicle = getStore()
    .table("vehicles")
    .find((v) => v.id === id);
  if (!vehicle) throw new VehicleNotFoundError(id);
  return vehicle;
};

export const vehiclesRepository = {
  async listActive(): Promise<Vehicle[]> {
    return getStore()
      .table("vehicles")
      .filter((v) => v.archivedAt === null)
      .sort(byName);
  },

  async listArchived(): Promise<Vehicle[]> {
    return getStore()
      .table("vehicles")
      .filter((v) => v.archivedAt !== null)
      .sort(byName);
  },

  async getById(id: string): Promise<Vehicle | undefined> {
    return getStore()
      .table("vehicles")
      .find((v) => v.id === id);
  },

  /** Every reading, voided included: that is what locks the unit (as the trigger does). */
  async readingCount(vehicleId: string): Promise<number> {
    return getStore()
      .table("readings")
      .filter((r) => r.vehicleId === vehicleId).length;
  },

  async create(raw: VehicleInput): Promise<Vehicle> {
    const input = vehicleInputSchema.parse(raw);
    const { orgId } = requireSession();
    const createdAt = nowIso();
    const vehicle: Vehicle = {
      id: uuidv7(),
      orgId,
      createdAt,
      updatedAt: createdAt,
      syncedAt: null,
      ...input,
      photoPath: null,
      archivedAt: null,
    };
    getStore().write("vehicles", vehicle);
    return vehicle;
  },

  async update(id: string, raw: VehicleInput): Promise<Vehicle> {
    const input = vehicleInputSchema.parse(raw);
    const existing = getOrThrow(id);
    if (input.unit !== existing.unit && !canChangeUnit(await this.readingCount(id))) {
      throw new UnitLockedError();
    }
    const vehicle: Vehicle = { ...existing, ...input, updatedAt: nowIso() };
    getStore().write("vehicles", vehicle);
    return vehicle;
  },

  /** Archiving hides the vehicle; its history stays and it can be restored. */
  async setArchived(id: string, archived: boolean): Promise<Vehicle> {
    const existing = getOrThrow(id);
    const now = nowIso();
    const vehicle: Vehicle = { ...existing, archivedAt: archived ? now : null, updatedAt: now };
    getStore().write("vehicles", vehicle);
    return vehicle;
  },
};

/** Remembers which vehicle the home screen and the quick action work with. */
export const selectVehicle = (id: string | null): void => {
  getStore().setPrefs({ selectedVehicleId: id });
};
