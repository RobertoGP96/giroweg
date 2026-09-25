import { and, eq, inArray, schema, sql } from "@giroweg/db";
import { readingSchema, vehicleSchema } from "@giroweg/shared/schemas";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/auth/requireUser";
import { describeDbError } from "@/db/errors";
import { readingFromRow, toIso, vehicleFromRow } from "@/db/rows";
import { getServerDb } from "@/db/server";

export const dynamic = "force-dynamic";

const pushSchema = z.object({
  vehicles: z.array(vehicleSchema).default([]),
  readings: z.array(readingSchema).default([]),
});

interface PushResult {
  table: "vehicles" | "readings";
  id: string;
  ok: boolean;
  syncedAt: string | null;
  error: string | null;
  /** Retrying the same record cannot succeed (validation, integrity). */
  permanent: boolean;
}

/** `excluded.<column>` inside ON CONFLICT DO UPDATE. */
const excluded = (column: { name: string }) => sql.raw(`excluded.${column.name}`);

/** Records a rejected record for the server log and tells the device why. */
const rejected = (table: PushResult["table"], id: string, cause: unknown): PushResult => {
  const described = describeDbError(cause);
  console.error(`[sync] ${table} ${id} rejected (${described.code ?? "no sqlstate"}): ${described.detail}`);
  return { table, id, ok: false, syncedAt: null, error: described.error, permanent: described.permanent };
};

/** Everything the organization has: the device replaces its local copy with it. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  if (!user.orgId) return NextResponse.json({ error: "no_organization" }, { status: 409 });

  try {
    const db = getServerDb();
    const [vehicleRows, readingRows] = await Promise.all([
      db.select().from(schema.vehicles).where(eq(schema.vehicles.orgId, user.orgId)),
      db.select().from(schema.readings).where(eq(schema.readings.orgId, user.orgId)),
    ]);
    return NextResponse.json({
      userId: user.id,
      organizationId: user.orgId,
      serverTime: new Date().toISOString(),
      vehicles: vehicleRows.map(vehicleFromRow),
      readings: readingRows.map(readingFromRow),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Idempotent upsert of the device outbox, vehicles before readings. The
 * organization and author always come from the verified user, never from
 * the payload. Vehicles: the most recent `updated_at` wins. Readings are
 * append-only: only voiding and the photo may change (trigger-enforced).
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
          setWhere: sql`${excluded(schema.vehicles.updatedAt)} > ${schema.vehicles.updatedAt} and ${schema.vehicles.orgId} = ${orgId}`,
        });
      results.push({ table: "vehicles", id: vehicle.id, ok: true, syncedAt: null, error: null, permanent: false });
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
          setWhere: sql`${excluded(schema.readings.updatedAt)} > ${schema.readings.updatedAt} and ${schema.readings.orgId} = ${orgId}`,
        });
      results.push({ table: "readings", id: reading.id, ok: true, syncedAt: null, error: null, permanent: false });
    } catch (cause) {
      results.push(rejected("readings", reading.id, cause));
    }
  }

  // Server sync time of every accepted record, so the device can show it.
  const acceptedVehicles = results.filter((r) => r.ok && r.table === "vehicles").map((r) => r.id);
  const acceptedReadings = results.filter((r) => r.ok && r.table === "readings").map((r) => r.id);
  const [vehicleStamps, readingStamps] = await Promise.all([
    acceptedVehicles.length
      ? db
          .select({ id: schema.vehicles.id, syncedAt: schema.vehicles.syncedAt })
          .from(schema.vehicles)
          .where(and(eq(schema.vehicles.orgId, orgId), inArray(schema.vehicles.id, acceptedVehicles)))
      : Promise.resolve([]),
    acceptedReadings.length
      ? db
          .select({ id: schema.readings.id, syncedAt: schema.readings.syncedAt })
          .from(schema.readings)
          .where(and(eq(schema.readings.orgId, orgId), inArray(schema.readings.id, acceptedReadings)))
      : Promise.resolve([]),
  ]);
  const stamps = new Map([...vehicleStamps, ...readingStamps].map((row) => [row.id, toIso(row.syncedAt)] as const));
  for (const result of results) {
    if (!result.ok) continue;
    const syncedAt = stamps.get(result.id);
    if (syncedAt) result.syncedAt = syncedAt;
    else Object.assign(result, { ok: false, error: "forbidden", permanent: true });
  }

  return NextResponse.json({ results });
}
