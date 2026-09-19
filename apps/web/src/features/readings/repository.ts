import {
  canVoid,
  currentOdometer,
  distanceTravelled,
  readingDeltas,
  validateReading,
  validReadings,
  type ReadingValidation,
} from "@giroweg/shared/domain";
import {
  readingInputSchema,
  voidReadingSchema,
  type Reading,
  type ReadingInput,
} from "@giroweg/shared/schemas";
import { getStore, requireSession } from "@/db/client";
import { nowIso, uuidv7 } from "@/lib/id";

export class ReadingRejectedError extends Error {
  constructor(public readonly validation: Exclude<ReadingValidation, { ok: true }>) {
    super(`Reading rejected: ${validation.reason}`);
    this.name = "ReadingRejectedError";
  }
}

export class ReadingAlreadyVoidedError extends Error {
  constructor() {
    super("Reading already voided");
    this.name = "ReadingAlreadyVoidedError";
  }
}

/** A reading with its increment over the previous valid one (null for the first, a reset or a void). */
export interface ReadingEntry {
  reading: Reading;
  delta: number | null;
}

export interface DayDistance {
  /** Local midnight, ISO. */
  date: string;
  distance: number;
  isToday: boolean;
}

export interface VehicleStats {
  monthDistance: number;
  monthReadings: number;
  weekDistance: number;
  /** Oldest first, seven days ending today. */
  days: DayDistance[];
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const readingsRepository = {
  /** Every reading of a vehicle, voided included, in no particular order. */
  async listByVehicle(vehicleId: string): Promise<Reading[]> {
    return getStore()
      .table("readings")
      .filter((r) => r.vehicleId === vehicleId);
  },

  /** Newest first, with increments. */
  async listEntries(vehicleId: string): Promise<ReadingEntry[]> {
    const readings = await this.listByVehicle(vehicleId);
    const deltas = readingDeltas(readings);
    return [...readings]
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((reading) => ({ reading, delta: deltas.get(reading.id) ?? null }));
  },

  async getById(id: string): Promise<Reading | undefined> {
    return getStore()
      .table("readings")
      .find((r) => r.id === id);
  },

  /** Latest valid value or the vehicle's initial value (domain rule 4). */
  async currentValue(vehicleId: string): Promise<number> {
    const vehicle = getStore()
      .table("vehicles")
      .find((v) => v.id === vehicleId);
    return currentOdometer(await this.listByVehicle(vehicleId), vehicle?.initialValue ?? 0);
  },

  /** Valid readings recorded since an instant, across every vehicle. */
  async countSince(iso: string): Promise<number> {
    return getStore()
      .table("readings")
      .filter((r) => r.voidedAt === null && r.recordedAt >= iso).length;
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
    const { orgId, userId } = requireSession();
    const existing = await this.listByVehicle(input.vehicleId);
    const validation = this.validate(input, existing);
    if (!validation.ok) throw new ReadingRejectedError(validation);

    const createdAt = nowIso();
    const reading: Reading = {
      id: uuidv7(),
      orgId,
      createdAt,
      updatedAt: createdAt,
      syncedAt: null,
      vehicleId: input.vehicleId,
      value: input.value,
      recordedAt: input.recordedAt,
      source: input.source,
      photoPath: null,
      note: input.note,
      createdBy: userId,
      voidedAt: null,
      voidReason: null,
      odometerReset: input.odometerReset,
    };
    getStore().write("readings", reading);
    return reading;
  },

  /** Readings are never edited or deleted: they are voided with a reason (domain rule 1). */
  async void(readingId: string, reason: string): Promise<Reading> {
    const input = voidReadingSchema.parse({ readingId, reason });
    const existing = await this.getById(input.readingId);
    if (!existing) throw new Error(`Reading not found: ${readingId}`);
    if (!canVoid(existing, input.reason)) throw new ReadingAlreadyVoidedError();
    const now = nowIso();
    const voided: Reading = { ...existing, voidedAt: now, voidReason: input.reason, updatedAt: now };
    getStore().write("readings", voided);
    return voided;
  },

  /** Figures for the home and detail screens, derived from the readings. */
  async stats(vehicleId: string, now: Date = new Date()): Promise<VehicleStats> {
    const readings = await this.listByVehicle(vehicleId);
    const nowIso8601 = now.toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = startOfDay(now);
    const days: DayDistance[] = Array.from({ length: 7 }, (_, index) => {
      const start = new Date(today);
      start.setDate(today.getDate() - (6 - index));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setMilliseconds(-1);
      return {
        date: start.toISOString(),
        distance: distanceTravelled(readings, start.toISOString(), end.toISOString()),
        isToday: index === 6,
      };
    });
    return {
      monthDistance: distanceTravelled(readings, monthStart, nowIso8601),
      monthReadings: validReadings(readings).filter((r) => r.recordedAt >= monthStart).length,
      weekDistance: days.reduce((sum, day) => sum + day.distance, 0),
      days,
    };
  },
};
