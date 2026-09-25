import { and, eq, inArray, schema, sql } from "@giroweg/db";
import { readingSchema, type TripRoute, tripRouteSchema, tripSchema, vehicleSchema } from "@giroweg/shared/schemas";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/auth/requireUser";
import { describeDbError } from "@/db/errors";
import { readingFromRow, toIso, tripFromRow, vehicleFromRow } from "@/db/rows";
import { getServerDb } from "@/db/server";
import type { PushResult } from "@/features/sync/protocol";

export const dynamic = "force-dynamic";

const pushSchema = z.object({
  vehicles: z.array(vehicleSchema).default([]),
  readings: z.array(readingSchema).default([]),
  trips: z.array(tripSchema).default([]),
  /** Routes are validated one by one so a bad one does not sink the whole push. */
  tripRoutes: z.array(z.unknown()).default([]),
});

/** The tables a push may carry; all share the `syncedRecord` columns. */
type SyncedTable = typeof schema.vehicles | typeof schema.readings | typeof schema.trips | typeof schema.tripRoutes;
interface Stamp {
  id: string;
  syncedAt: string | Date;
}

/** `excluded.<column>` inside ON CONFLICT DO UPDATE. */
const excluded = (column: { name: string }) => sql.raw(`excluded.${column.name}`);

const accepted = (table: PushResult["table"], id: string): PushResult => ({
  table,
  id,
  ok: true,
  syncedAt: null,
  error: null,
  permanent: false,
});

/** Records a rejected record for the server log and tells the device why. */
const rejected = (table: PushResult["table"], id: string, cause: unknown): PushResult => {
  const described = describeDbError(cause);
  console.error(`[sync] ${table} ${id} rejected (${described.code ?? "no sqlstate"}): ${described.detail}`);
  return { table, id, ok: false, syncedAt: null, error: described.error, permanent: described.permanent };
};

/** The id of an unvalidated route item, when it carries a string one. */
const routeIdOf = (item: unknown): string => {
  if (typeof item === "object" && item !== null && "id" in item && typeof item.id === "string") return item.id;
  return "unknown";
};

/** Everything the organization has: the device replaces its local copy with it. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  if (!user.orgId) return NextResponse.json({ error: "no_organization" }, { status: 409 });

  try {
    const db = getServerDb();
    const [vehicleRows, readingRows, tripRows] = await Promise.all([
      db.select().from(schema.vehicles).where(eq(schema.vehicles.orgId, user.orgId)),
      db.select().from(schema.readings).where(eq(schema.readings.orgId, user.orgId)),
      db.select().from(schema.trips).where(eq(schema.trips.orgId, user.orgId)),
    ]);
    return NextResponse.json({
      userId: user.id,
      organizationId: user.orgId,
      serverTime: new Date().toISOString(),
      vehicles: vehicleRows.map(vehicleFromRow),
      readings: readingRows.map(readingFromRow),
      trips: tripRows.map(tripFromRow),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Idempotent upsert of the device outbox: vehicles, readings, trips, then
 * routes. The organization and author always come from the verified user,
 * never from the payload. Vehicles: the most recent `updated_at` wins.
 * Readings are append-only: only voiding and the photo may change. Trips
 * only change when they end (trigger-enforced). Routes are replaced whole.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  if (!user.orgId) return NextResponse.json({ error: "no_organization" }, { status: 409 });
  const orgId = user.orgId;

  const parsed = pushSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    console.error(`[sync] invalid payload: ${issues}`);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const db = getServerDb();
  const results: PushResult[] = [];
  /** Only a row of this organization may be updated, and only by a newer version. */
  const newerAndMine = (table: { updatedAt: { name: string }; orgId: { name: string } }) =>
    sql`${excluded(table.updatedAt)} > ${table.updatedAt} and ${table.orgId} = ${orgId}`;

  for (const vehicle of parsed.data.vehicles) {
    try {
      await db
        .insert(schema.vehicles)
        .values({
          id: vehicle.id,
          orgId,
          createdAt: vehicle.createdAt,
          updatedAt: vehicle.updatedAt,
          type: vehicle.type,
          name: vehicle.name,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          plate: vehicle.plate,
          photoPath: vehicle.photoPath,
          unit: vehicle.unit,
          initialValue: vehicle.initialValue,
          archivedAt: vehicle.archivedAt,
        })
        .onConflictDoUpdate({
          target: schema.vehicles.id,
          set: {
            updatedAt: excluded(schema.vehicles.updatedAt),
            type: excluded(schema.vehicles.type),
            name: excluded(schema.vehicles.name),
            brand: excluded(schema.vehicles.brand),
            model: excluded(schema.vehicles.model),
            year: excluded(schema.vehicles.year),
            plate: excluded(schema.vehicles.plate),
            photoPath: excluded(schema.vehicles.photoPath),
            unit: excluded(schema.vehicles.unit),
            initialValue: excluded(schema.vehicles.initialValue),
            archivedAt: excluded(schema.vehicles.archivedAt),
          },
          setWhere: newerAndMine(schema.vehicles),
        });
      results.push(accepted("vehicles", vehicle.id));
    } catch (cause) {
      results.push(rejected("vehicles", vehicle.id, cause));
    }
  }

  for (const reading of parsed.data.readings) {
    try {
      await db
        .insert(schema.readings)
        .values({
          id: reading.id,
          orgId,
          createdAt: reading.createdAt,
          updatedAt: reading.updatedAt,
          vehicleId: reading.vehicleId,
          value: reading.value,
          recordedAt: reading.recordedAt,
          source: reading.source,
          photoPath: reading.photoPath,
          note: reading.note,
          createdBy: user.id,
          voidedAt: reading.voidedAt,
          voidReason: reading.voidReason,
          odometerReset: reading.odometerReset,
        })
        .onConflictDoUpdate({
          target: schema.readings.id,
          set: {
            updatedAt: excluded(schema.readings.updatedAt),
            voidedAt: excluded(schema.readings.voidedAt),
            voidReason: excluded(schema.readings.voidReason),
            photoPath: excluded(schema.readings.photoPath),
          },
          setWhere: newerAndMine(schema.readings),
        });
      results.push(accepted("readings", reading.id));
    } catch (cause) {
      results.push(rejected("readings", reading.id, cause));
    }
  }

  for (const trip of parsed.data.trips) {
    try {
      await db
        .insert(schema.trips)
        .values({
          id: trip.id,
          orgId,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          vehicleId: trip.vehicleId,
          startReadingId: trip.startReadingId,
          endReadingId: trip.endReadingId,
          startedAt: trip.startedAt,
          endedAt: trip.endedAt,
          gpsDistance: trip.gpsDistance,
          reason: trip.reason,
          stops: trip.stops,
          pauses: trip.pauses,
          pausedSeconds: trip.pausedSeconds,
        })
        .onConflictDoUpdate({
          target: schema.trips.id,
          set: {
            updatedAt: excluded(schema.trips.updatedAt),
            endReadingId: excluded(schema.trips.endReadingId),
            endedAt: excluded(schema.trips.endedAt),
            gpsDistance: excluded(schema.trips.gpsDistance),
            reason: excluded(schema.trips.reason),
            stops: excluded(schema.trips.stops),
            pauses: excluded(schema.trips.pauses),
            pausedSeconds: excluded(schema.trips.pausedSeconds),
          },
          setWhere: newerAndMine(schema.trips),
        });
      results.push(accepted("trips", trip.id));
    } catch (cause) {
      results.push(rejected("trips", trip.id, cause));
    }
  }

  for (const item of parsed.data.tripRoutes) {
    const validated = tripRouteSchema.safeParse(item);
    if (!validated.success) {
      results.push({
        table: "tripRoutes",
        id: routeIdOf(item),
        ok: false,
        syncedAt: null,
        error: "invalid_route",
        permanent: true,
      });
      continue;
    }
    const route: TripRoute = validated.data;
    try {
      await db
        .insert(schema.tripRoutes)
        .values({
          id: route.id,
          orgId,
          createdAt: route.createdAt,
          updatedAt: route.updatedAt,
          tripId: route.tripId,
          segments: route.segments,
          pointCount: route.pointCount,
        })
        .onConflictDoUpdate({
          target: schema.tripRoutes.id,
          set: {
            updatedAt: excluded(schema.tripRoutes.updatedAt),
            segments: excluded(schema.tripRoutes.segments),
            pointCount: excluded(schema.tripRoutes.pointCount),
          },
          setWhere: newerAndMine(schema.tripRoutes),
        });
      results.push(accepted("tripRoutes", route.id));
    } catch (cause) {
      results.push(rejected("tripRoutes", route.id, cause));
    }
  }

  // Server sync time of every accepted record, so the device can show it.
  const stampsOf = async (table: PushResult["table"], from: SyncedTable): Promise<Stamp[]> => {
    const ids = results.filter((r) => r.ok && r.table === table).map((r) => r.id);
    if (ids.length === 0) return [];
    return db
      .select({ id: from.id, syncedAt: from.syncedAt })
      .from(from)
      .where(and(eq(from.orgId, orgId), inArray(from.id, ids)));
  };
  const stampRows = await Promise.all([
    stampsOf("vehicles", schema.vehicles),
    stampsOf("readings", schema.readings),
    stampsOf("trips", schema.trips),
    stampsOf("tripRoutes", schema.tripRoutes),
  ]);
  const stamps = new Map(stampRows.flat().map((row) => [row.id, toIso(row.syncedAt)] as const));
  for (const result of results) {
    if (!result.ok) continue;
    const syncedAt = stamps.get(result.id);
    if (syncedAt) result.syncedAt = syncedAt;
    else Object.assign(result, { ok: false, error: "forbidden", permanent: true });
  }

  return NextResponse.json({ results });
}
