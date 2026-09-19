import { index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { distance, syncedRecord, timestamptz } from "./columns";
import { distanceUnit, vehicleType } from "./enums";
import { orgPolicies } from "./rls";

export const vehicles = pgTable(
  "vehicles",
  {
    ...syncedRecord,
    type: vehicleType("type").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    model: text("model"),
    year: integer("year"),
    plate: text("plate"),
    photoPath: text("photo_path"),
    /** Immutable once the vehicle has a reading (trigger, domain rule 3). */
    unit: distanceUnit("unit").notNull(),
    initialValue: distance("initial_value").notNull().default(0),
    archivedAt: timestamptz("archived_at"),
  },
  (t) => [
    // Lets child tables reference (vehicle_id, org_id) so a vehicle can never belong to another org's record.
    unique("vehicles_id_org_unique").on(t.id, t.orgId),
    index("vehicles_org_idx").on(t.orgId),
    ...orgPolicies("vehicles", t.orgId, { delete: "admin" }),
  ],
).enableRLS();
