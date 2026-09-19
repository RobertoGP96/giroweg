import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { distance, syncedRecord, timestamptz } from "./columns";
import { readingSource } from "./enums";
import { orgPolicies } from "./rls";
import { vehicles } from "./vehicles";

/**
 * Append-only odometer readings (domain rule 1). Corrections are voids plus
 * new readings; a trigger rejects deletes and any update other than voiding.
 * Ordering rule 2 (never below the previous valid reading nor above the
 * next) is enforced by `readings_validate` (migration 0002); an odometer
 * change is an explicit reset that restarts the sequence and requires a note.
 */
export const readings = pgTable(
  "readings",
  {
    ...syncedRecord,
    vehicleId: uuid("vehicle_id").notNull(),
    value: distance("value").notNull(),
    /** Device time (domain rule 5). */
    recordedAt: timestamptz("recorded_at").notNull(),
    source: readingSource("source").notNull(),
    photoPath: text("photo_path"),
    note: text("note"),
    /** Neon Auth user id. */
    createdBy: text("created_by").notNull(),
    voidedAt: timestamptz("voided_at"),
    voidReason: text("void_reason"),
    odometerReset: boolean("odometer_reset").notNull().default(false),
  },
  (t) => [
    foreignKey({
      name: "readings_vehicle_fk",
      columns: [t.vehicleId, t.orgId],
      foreignColumns: [vehicles.id, vehicles.orgId],
    }),
    unique("readings_id_org_unique").on(t.id, t.orgId),
    index("readings_vehicle_recorded_idx").on(t.vehicleId, t.recordedAt),
    check("readings_value_nonnegative", sql`${t.value} >= 0`),
    check("readings_void_reason", sql`${t.voidedAt} IS NULL OR ${t.voidReason} IS NOT NULL`),
    check("readings_reset_note", sql`${t.odometerReset} = false OR ${t.note} IS NOT NULL`),
    ...orgPolicies("readings", t.orgId, { delete: "none" }),
  ],
).enableRLS();
