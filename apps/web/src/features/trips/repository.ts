import {
  compareGpsWithOdometer,
  isDistanceUnit,
  tripDistance,
  type GpsComparison,
} from "@giroweg/shared/domain";
import {
  tripEndInputSchema,
  tripRouteSchema,
  tripStartInputSchema,
  type Reading,
  type Trip,
  type TripEndInput,
  type TripRoute,
  type TripStartInput,
  type Vehicle,
} from "@giroweg/shared/schemas";
import { getStore, requireSession } from "@/db/client";
import { nowIso, uuidv7 } from "@/lib/id";
import { readingsRepository } from "@/features/readings/repository";
import { VehicleNotFoundError, vehiclesRepository } from "@/features/vehicles/repository";

/** GPS trips only make sense for vehicles measured in distance, not hours. */
export class TripUnitNotSupportedError extends Error {
  constructor(unit: string) {
    super(`Trips are not supported for vehicles measured in ${unit}`);
    this.name = "TripUnitNotSupportedError";
  }
}

export class TripAlreadyActiveError extends Error {
  constructor(public readonly tripId: string) {
    super(`A trip is already in progress: ${tripId}`);
    this.name = "TripAlreadyActiveError";
  }
}

export class TripNotFoundError extends Error {
  constructor(id: string) {
    super(`Trip not found: ${id}`);
    this.name = "TripNotFoundError";
  }
}

export class TripNotOpenError extends Error {
  constructor(id: string) {
    super(`Trip is not open: ${id}`);
    this.name = "TripNotOpenError";
  }
}

export type TripState = "open" | "ended" | "cancelled";

export interface TripSummary {
  trip: Trip;
  vehicle: Vehicle | undefined;
  start: Reading | undefined;
  end: Reading | undefined;
  /** Odometer distance (domain rule 4: derived from readings); null when either reading is missing or voided. */
  distance: number | null;
  /** How the GPS distance compares with the odometer; null without both distances. */
  gps: GpsComparison | null;
  durationSeconds: number | null;
  /** A voided start or end reading, or a GPS distance outside the tolerance. */
  needsReview: boolean;
  state: TripState;
}

export const tripState = (trip: Trip): TripState =>
  trip.endedAt === null ? "open" : trip.endReadingId === null ? "cancelled" : "ended";

const secondsBetween = (from: string, to: string): number =>
  Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 1000));

const summarize = (trip: Trip): TripSummary => {
  const store = getStore();
  const vehicle = store.table("vehicles").find((v) => v.id === trip.vehicleId);
  const start = store.table("readings").find((r) => r.id === trip.startReadingId);
  const end =
    trip.endReadingId === null
      ? undefined
      : store.table("readings").find((r) => r.id === trip.endReadingId);
  const voided = (start !== undefined && start.voidedAt !== null) || (end !== undefined && end.voidedAt !== null);
  const distance =
    start && end && start.voidedAt === null && end.voidedAt === null ? tripDistance(start.value, end.value) : null;
  const gps =
    distance !== null && trip.gpsDistance !== null ? compareGpsWithOdometer(distance, trip.gpsDistance) : null;
  return {
    trip,
    vehicle,
    start,
    end,
    distance,
    gps,
    durationSeconds: trip.endedAt === null ? null : secondsBetween(trip.startedAt, trip.endedAt),
    needsReview: voided || (gps !== null && !gps.withinMargin),
    state: tripState(trip),
  };
};

/** Open trips first, then newest first. */
const byRecency = (a: Trip, b: Trip): number => {
  const openA = a.endedAt === null ? 0 : 1;
  const openB = b.endedAt === null ? 0 : 1;
  if (openA !== openB) return openA - openB;
  return b.startedAt.localeCompare(a.startedAt);
};

const findRoute = (tripId: string): TripRoute | undefined =>
  getStore()
    .table("tripRoutes")
    .find((route) => route.tripId === tripId);

const getOrThrow = (id: string): Trip => {
  const trip = getStore()
    .table("trips")
    .find((t) => t.id === id);
  if (!trip) throw new TripNotFoundError(id);
  return trip;
};

export const tripsRepository = {
  async listByVehicle(vehicleId: string): Promise<TripSummary[]> {
    return getStore()
      .table("trips")
      .filter((trip) => trip.vehicleId === vehicleId)
      .sort(byRecency)
      .map(summarize);
  },

  async listAll(): Promise<TripSummary[]> {
    return [...getStore().table("trips")].sort(byRecency).map(summarize);
  },

  async getById(id: string): Promise<TripSummary | undefined> {
    const trip = getStore()
      .table("trips")
      .find((t) => t.id === id);
    return trip ? summarize(trip) : undefined;
  },

  /** The trip in progress (for one vehicle, or any), if there is one. */
  async findOpen(vehicleId?: string): Promise<Trip | undefined> {
    return getStore()
      .table("trips")
      .find((trip) => trip.endedAt === null && (vehicleId === undefined || trip.vehicleId === vehicleId));
  },

  async getRoute(tripId: string): Promise<TripRoute | undefined> {
    return findRoute(tripId);
  },

  /**
   * Opens a trip by recording the odometer at departure. The start reading is
   * a regular reading (domain rules 1 and 2 apply through readingsRepository),
   * so a rejected value leaves nothing written.
   */
  async start(raw: TripStartInput): Promise<{ trip: Trip; reading: Reading }> {
    const input = tripStartInputSchema.parse(raw);
    const { orgId } = requireSession();
    const vehicle = await vehiclesRepository.getById(input.vehicleId);
    if (!vehicle) throw new VehicleNotFoundError(input.vehicleId);
    if (!isDistanceUnit(vehicle.unit)) throw new TripUnitNotSupportedError(vehicle.unit);
    const open = await this.findOpen(input.vehicleId);
    if (open) throw new TripAlreadyActiveError(open.id);

    const reading = await readingsRepository.add({
      vehicleId: input.vehicleId,
      value: input.value,
      recordedAt: input.recordedAt,
      source: "manual",
      note: null,
    });
    const now = nowIso();
    const trip: Trip = {
      id: uuidv7(),
      orgId,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      vehicleId: input.vehicleId,
      startReadingId: reading.id,
      endReadingId: null,
      startedAt: reading.recordedAt,
      endedAt: null,
      gpsDistance: null,
      reason: null,
      stops: 0,
      pauses: 0,
      pausedSeconds: 0,
    };
    getStore().write("trips", trip);
    return { trip, reading };
  },

  /**
   * Closes a trip with the odometer at arrival. The end reading is validated
   * first (domain rule 2: never below the previous valid reading) so a
   * rejection leaves the trip open and nothing written. The GPS distance is
   * stored on the trip as a comparison figure (rule 6: the odometer value the
   * user confirmed is the one that counts); the route goes to its own row.
   */
  async end(raw: TripEndInput): Promise<{ trip: Trip; reading: Reading; route: TripRoute | null }> {
    // Segments shorter than two points cannot be drawn: drop them before validating.
    const input = tripEndInputSchema.parse({
      ...raw,
      segments: (raw.segments ?? []).filter((segment) => segment.length >= 2),
    });
    const { orgId } = requireSession();
    const existing = getOrThrow(input.tripId);
    if (existing.endedAt !== null) throw new TripNotOpenError(existing.id);

    const reading = await readingsRepository.add({
      vehicleId: existing.vehicleId,
      value: input.value,
      recordedAt: input.recordedAt,
      source: input.source,
      note: null,
    });
    const now = nowIso();
    const trip: Trip = {
      ...existing,
      endReadingId: reading.id,
      endedAt: input.recordedAt,
      gpsDistance: input.gpsDistance,
      pauses: input.pauses,
      pausedSeconds: input.pausedSeconds,
      reason: input.reason,
      updatedAt: now,
    };
    getStore().write("trips", trip);

    const pointCount = input.segments.reduce((n, segment) => n + segment.length, 0);
    let route: TripRoute | null = null;
    if (pointCount >= 2) {
      const previous = findRoute(trip.id);
      route = tripRouteSchema.parse({
        id: previous?.id ?? uuidv7(),
        orgId,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        syncedAt: null,
        tripId: trip.id,
        segments: input.segments,
        pointCount,
      });
      getStore().write("tripRoutes", route);
    }
    return { trip, reading, route };
  },

  /**
   * Corrects the arrival odometer: the old reading is voided with a reason
   * (domain rule 1: readings are never edited) and a new one takes its place
   * at the same instant, so the trip keeps its end time.
   */
  async replaceEndReading(
    tripId: string,
    value: number,
    voidReason: string,
  ): Promise<{ trip: Trip; reading: Reading }> {
    const existing = getOrThrow(tripId);
    if (existing.endReadingId === null || existing.endedAt === null) throw new TripNotOpenError(existing.id);
    await readingsRepository.void(existing.endReadingId, voidReason);
    const reading = await readingsRepository.add({
      vehicleId: existing.vehicleId,
      value,
      recordedAt: existing.endedAt,
      source: "manual",
      note: null,
    });
    const trip: Trip = { ...existing, endReadingId: reading.id, updatedAt: nowIso() };
    getStore().write("trips", trip);
    return { trip, reading };
  },

  /** Cancels an open trip: it closes now without an end reading; the start reading stays (rule 1). */
  async discard(tripId: string): Promise<Trip> {
    const existing = getOrThrow(tripId);
    if (existing.endedAt !== null) throw new TripNotOpenError(existing.id);
    const now = nowIso();
    const trip: Trip = { ...existing, endedAt: now, endReadingId: null, updatedAt: now };
    getStore().write("trips", trip);
    return trip;
  },
};
