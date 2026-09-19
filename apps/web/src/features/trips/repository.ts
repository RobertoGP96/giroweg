import { compareGpsWithOdometer, tripDistance, type GpsComparison } from "@giroweg/shared/domain";
import type { Reading, Trip } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import { ORG_ID } from "@/db/seed";
import { nowIso, uuidv7 } from "@/lib/id";

/** A trip joined with its readings and derived figures. */
export interface TripSummary {
  trip: Trip;
  start: Reading;
  end: Reading | undefined;
  /** Odometer distance (end − start). */
  distance: number;
  durationMinutes: number;
  gps: GpsComparison | null;
  /** Flagged when GPS and odometer disagree beyond tolerance. */
  needsReview: boolean;
}

const minutesBetween = (a: string, b: string): number =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));

const summarize = (trip: Trip): TripSummary | null => {
  const readings = getStore().table("readings");
  const start = readings.find((r) => r.id === trip.startReadingId);
  if (!start) return null;
  const end = readings.find((r) => r.id === trip.endReadingId);
  const distance = end ? tripDistance(start.value, end.value) : 0;
  const gps = end && trip.gpsDistance !== null ? compareGpsWithOdometer(distance, trip.gpsDistance) : null;
  return {
    trip,
    start,
    end,
    distance,
    durationMinutes: trip.endedAt ? minutesBetween(trip.startedAt, trip.endedAt) : 0,
    gps,
    needsReview: gps ? !gps.withinMargin : false,
  };
};

export interface NewTripInput {
  vehicleId: string;
  startReadingId: string;
  endReadingId: string;
  startedAt: string;
  endedAt: string;
  gpsDistance: number;
  stops: number;
  pauses: number;
  pausedSeconds: number;
  reason: string | null;
}

export const tripsRepository = {
  /** Finished trips of a vehicle, newest first. */
  async listByVehicle(vehicleId: string): Promise<TripSummary[]> {
    return getStore()
      .table("trips")
      .filter((t) => t.vehicleId === vehicleId && t.endedAt !== null)
      .map(summarize)
      .filter((s): s is TripSummary => s !== null)
      .sort((a, b) => b.trip.startedAt.localeCompare(a.trip.startedAt));
  },

  async getById(id: string): Promise<TripSummary | undefined> {
    const trip = getStore()
      .table("trips")
      .find((t) => t.id === id);
    return trip ? (summarize(trip) ?? undefined) : undefined;
  },

  async add(input: NewTripInput): Promise<Trip> {
    const createdAt = nowIso();
    const trip: Trip = {
      id: uuidv7(),
      orgId: ORG_ID,
      createdAt,
      updatedAt: createdAt,
      syncedAt: null,
      ...input,
    };
    getStore().write("trips", trip);
    return trip;
  },
};
