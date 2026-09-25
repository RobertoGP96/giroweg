import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import type { RoutePoint } from "@giroweg/shared/domain";
import { syncedRecord } from "./columns";
import { orgPolicies } from "./rls";
import { trips } from "./trips";

/**
 * One simplified GPS track per trip. `segments` is split at pauses and
 * signal gaps; each point is `[lng, lat, tOffsetMs, accuracyM]` where
 * `tOffsetMs` counts from `trips.started_at`. The distance is computed on
 * the client and stored in `trips.gps_distance`; there is no PostGIS here,
 * the track is only kept to draw the route.
 */
export const tripRoutes = pgTable(
  "trip_routes",
  {
    ...syncedRecord,
    tripId: uuid("trip_id").notNull(),
    segments: jsonb("segments").$type<RoutePoint[][]>().notNull(),
    pointCount: integer("point_count").notNull(),
  },
  (t) => [
    foreignKey({
      name: "trip_routes_trip_fk",
      columns: [t.tripId, t.orgId],
      foreignColumns: [trips.id, trips.orgId],
    }).onDelete("cascade"),
    unique("trip_routes_trip_unique").on(t.tripId),
    index("trip_routes_org_idx").on(t.orgId),
    check("trip_routes_point_count_min", sql`${t.pointCount} >= 2`),
    check("trip_routes_segments_array", sql`jsonb_typeof(${t.segments}) = 'array'`),
    ...orgPolicies("trip_routes", t.orgId, { delete: "admin" }),
  ],
).enableRLS();
