import "server-only";

import type { ReadingRow, TripRouteRow, TripRow, VehicleRow } from "@giroweg/db";
import { type Reading, type Trip, type TripRoute, tripRouteSchema, type Vehicle } from "@giroweg/shared/schemas";

/**
 * The app speaks ISO 8601 UTC everywhere (domain rule 5). Drizzle types
 * `timestamptz` columns as strings, but the Neon HTTP driver hands them
 * over parsed as `Date`; raw Postgres text ("2026-09-19 12:34:56.789+00")
 * and ISO input are normalised too.
 */
export const toIso = (value: string | Date): string => {
  if (value instanceof Date) return value.toISOString();
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp from database: ${value}`);
  return date.toISOString();
};

const nullableIso = (value: string | Date | null): string | null => (value === null ? null : toIso(value));

export const vehicleFromRow = (row: VehicleRow): Vehicle => ({
  id: row.id,
  orgId: row.orgId,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  syncedAt: toIso(row.syncedAt),
  type: row.type,
  name: row.name,
  brand: row.brand,
  model: row.model,
  year: row.year,
  plate: row.plate,
  photoPath: row.photoPath,
  unit: row.unit,
  initialValue: Number(row.initialValue),
  archivedAt: nullableIso(row.archivedAt),
});

export const readingFromRow = (row: ReadingRow): Reading => ({
  id: row.id,
  orgId: row.orgId,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  syncedAt: toIso(row.syncedAt),
  vehicleId: row.vehicleId,
  value: Number(row.value),
  recordedAt: toIso(row.recordedAt),
  source: row.source,
  photoPath: row.photoPath,
  note: row.note,
  createdBy: row.createdBy,
  voidedAt: nullableIso(row.voidedAt),
  voidReason: row.voidReason,
  odometerReset: row.odometerReset,
});

export const tripFromRow = (row: TripRow): Trip => ({
  id: row.id,
  orgId: row.orgId,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  syncedAt: toIso(row.syncedAt),
  vehicleId: row.vehicleId,
  startReadingId: row.startReadingId,
  endReadingId: row.endReadingId,
  startedAt: toIso(row.startedAt),
  endedAt: nullableIso(row.endedAt),
  gpsDistance: row.gpsDistance === null ? null : Number(row.gpsDistance),
  reason: row.reason,
  stops: row.stops,
  pauses: row.pauses,
  pausedSeconds: row.pausedSeconds,
});

/** The jsonb `segments` is never trusted as-is: the whole route is re-validated. */
export const tripRouteFromRow = (row: TripRouteRow): TripRoute =>
  tripRouteSchema.parse({
    id: row.id,
    orgId: row.orgId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    syncedAt: toIso(row.syncedAt),
    tripId: row.tripId,
    segments: row.segments,
    pointCount: row.pointCount,
  });
