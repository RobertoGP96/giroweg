import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { distance, syncedRecord, timestamptz } from "./columns";
import { readings } from "./readings";
import { orgPolicies } from "./rls";
import { vehicles } from "./vehicles";

export const trips = pgTable(
  "trips",
  {
    ...syncedRecord,
    vehicleId: uuid("vehicle_id").notNull(),
    startReadingId: uuid("start_reading_id").notNull(),
    endReadingId: uuid("end_reading_id"),
    startedAt: timestamptz("started_at").notNull(),
    endedAt: timestamptz("ended_at"),
    /** Distance measured by GPS, in the vehicle unit. */
    gpsDistance: distance("gps_distance"),
    reason: text("reason"),
    stops: integer("stops").notNull().default(0),
    pauses: integer("pauses").notNull().default(0),
    pausedSeconds: integer("paused_seconds").notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: "trips_vehicle_fk",
      columns: [t.vehicleId, t.orgId],
      foreignColumns: [vehicles.id, vehicles.orgId],
    }),
    foreignKey({
      name: "trips_start_reading_fk",
      columns: [t.startReadingId, t.orgId],
      foreignColumns: [readings.id, readings.orgId],
    }),
    foreignKey({
      name: "trips_end_reading_fk",
      columns: [t.endReadingId, t.orgId],
      foreignColumns: [readings.id, readings.orgId],
    }),
    index("trips_vehicle_started_idx").on(t.vehicleId, t.startedAt),
    check("trips_ended_after_started", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
    check("trips_counters_nonnegative", sql`${t.stops} >= 0 AND ${t.pauses} >= 0 AND ${t.pausedSeconds} >= 0`),
    ...orgPolicies("trips", t.orgId, { delete: "admin" }),
  ],
).enableRLS();
