import "server-only";

import type { ReadingRow, VehicleRow } from "@giroweg/db";
import type { Reading, Vehicle } from "@giroweg/shared/schemas";

/**
 * Postgres returns timestamptz as text ("2026-09-19 12:34:56.789+00"); the
 * app speaks ISO 8601 UTC everywhere (domain rule 5). Already-ISO input
 * passes through unchanged.
 */
export const toIso = (value: string): string => {
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp from database: ${value}`);
  return date.toISOString();
};

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
  initialValue: row.initialValue,
  archivedAt: row.archivedAt === null ? null : toIso(row.archivedAt),
});

export const readingFromRow = (row: ReadingRow): Reading => ({
  id: row.id,
  orgId: row.orgId,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  syncedAt: toIso(row.syncedAt),
  vehicleId: row.vehicleId,
  value: row.value,
  recordedAt: toIso(row.recordedAt),
  source: row.source,
  photoPath: row.photoPath,
  note: row.note,
  createdBy: row.createdBy,
  voidedAt: row.voidedAt === null ? null : toIso(row.voidedAt),
  voidReason: row.voidReason,
  odometerReset: row.odometerReset,
});
