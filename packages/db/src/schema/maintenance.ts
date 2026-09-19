import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { distance, syncedRecord, timestamptz } from "./columns";
import { readings } from "./readings";
import { orgPolicies } from "./rls";
import { vehicles } from "./vehicles";

/** A rule fires every N units of distance or every N days. */
export const maintenanceRules = pgTable(
  "maintenance_rules",
  {
    ...syncedRecord,
    vehicleId: uuid("vehicle_id").notNull(),
    name: text("name").notNull(),
    everyUnits: distance("every_units"),
    everyDays: integer("every_days"),
    remindUnitsBefore: distance("remind_units_before").notNull().default(300),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    foreignKey({
      name: "maintenance_rules_vehicle_fk",
      columns: [t.vehicleId, t.orgId],
      foreignColumns: [vehicles.id, vehicles.orgId],
    }),
    unique("maintenance_rules_id_org_unique").on(t.id, t.orgId),
    index("maintenance_rules_vehicle_idx").on(t.vehicleId),
    check("maintenance_rules_interval", sql`${t.everyUnits} IS NOT NULL OR ${t.everyDays} IS NOT NULL`),
    check(
      "maintenance_rules_positive",
      sql`(${t.everyUnits} IS NULL OR ${t.everyUnits} > 0) AND (${t.everyDays} IS NULL OR ${t.everyDays} > 0)`,
    ),
    ...orgPolicies("maintenance_rules", t.orgId, { delete: "admin" }),
  ],
).enableRLS();

export const maintenanceEvents = pgTable(
  "maintenance_events",
  {
    ...syncedRecord,
    vehicleId: uuid("vehicle_id").notNull(),
    ruleId: uuid("rule_id").notNull(),
    readingId: uuid("reading_id"),
    /** Odometer value when the service was done. */
    atValue: distance("at_value").notNull(),
    doneAt: timestamptz("done_at").notNull(),
    note: text("note"),
  },
  (t) => [
    foreignKey({
      name: "maintenance_events_vehicle_fk",
      columns: [t.vehicleId, t.orgId],
      foreignColumns: [vehicles.id, vehicles.orgId],
    }),
    foreignKey({
      name: "maintenance_events_rule_fk",
      columns: [t.ruleId, t.orgId],
      foreignColumns: [maintenanceRules.id, maintenanceRules.orgId],
    }),
    foreignKey({
      name: "maintenance_events_reading_fk",
      columns: [t.readingId, t.orgId],
      foreignColumns: [readings.id, readings.orgId],
    }),
    index("maintenance_events_rule_done_idx").on(t.ruleId, t.doneAt),
    ...orgPolicies("maintenance_events", t.orgId, { delete: "admin" }),
  ],
).enableRLS();
