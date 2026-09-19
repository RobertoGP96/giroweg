import { currentOdometer, validateReading, type ReadingValidation } from "@giroweg/shared/domain";
import { readingInputSchema, type Reading, type ReadingInput } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import { ORG_ID, USER_ID } from "@/db/seed";
import { nowIso, uuidv7 } from "@/lib/id";

export class ReadingRejectedError extends Error {
  constructor(public readonly validation: Exclude<ReadingValidation, { ok: true }>) {
    super(`Reading rejected: ${validation.reason}`);
    this.name = "ReadingRejectedError";
  }
}

export const readingsRepository = {
  async listByVehicle(vehicleId: string): Promise<Reading[]> {
    return getStore()
      .table("readings")
      .filter((r) => r.vehicleId === vehicleId);
  },

  async getById(id: string): Promise<Reading | undefined> {
    return getStore()
      .table("readings")
      .find((r) => r.id === id);
  },

  /** Latest valid value or the vehicle's initial value (domain rule 4). */
  async currentValue(vehicleId: string): Promise<number> {
    const store = getStore();
    const vehicle = store.table("vehicles").find((v) => v.id === vehicleId);
    const readings = await this.listByVehicle(vehicleId);
    return currentOdometer(readings, vehicle?.initialValue ?? 0);
  },

  /** Validates against neighbours (domain rule 2) and appends (domain rule 1). */
  validate(input: ReadingInput, existing: Reading[]): ReadingValidation {
    return validateReading(
      { value: input.value, recordedAt: input.recordedAt, odometerReset: input.odometerReset ?? false },
      existing,
    );
  },

  async add(raw: ReadingInput): Promise<Reading> {
    const input = readingInputSchema.parse(raw);
    const existing = await this.listByVehicle(input.vehicleId);
    const validation = this.validate(input, existing);
    if (!validation.ok) throw new ReadingRejectedError(validation);

    const createdAt = nowIso();
    const reading: Reading = {
      id: uuidv7(),
      orgId: ORG_ID,
      createdAt,
      updatedAt: createdAt,
      syncedAt: null,
      vehicleId: input.vehicleId,
      value: input.value,
      recordedAt: input.recordedAt,
      source: input.source,
      photoPath: null,
      note: input.note,
      createdBy: USER_ID,
      voidedAt: null,
      voidReason: null,
      odometerReset: input.odometerReset,
    };
    getStore().write("readings", reading);
    return reading;
  },
};
