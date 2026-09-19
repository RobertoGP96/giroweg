import { sql } from "drizzle-orm";
import { check, foreignKey, index, numeric, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { syncedRecord, timestamptz } from "./columns";
import { expenseType } from "./enums";
import { readings } from "./readings";
import { orgPolicies } from "./rls";
import { vehicles } from "./vehicles";

export const expenses = pgTable(
  "expenses",
  {
    ...syncedRecord,
    vehicleId: uuid("vehicle_id").notNull(),
    type: expenseType("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    /** ISO 4217. */
    currency: varchar("currency", { length: 3 }).notNull(),
    litres: numeric("litres", { precision: 8, scale: 2, mode: "number" }),
    readingId: uuid("reading_id"),
    receiptPath: text("receipt_path"),
    note: text("note"),
    occurredAt: timestamptz("occurred_at").notNull(),
  },
  (t) => [
    foreignKey({
      name: "expenses_vehicle_fk",
      columns: [t.vehicleId, t.orgId],
      foreignColumns: [vehicles.id, vehicles.orgId],
    }),
    foreignKey({
      name: "expenses_reading_fk",
      columns: [t.readingId, t.orgId],
      foreignColumns: [readings.id, readings.orgId],
    }),
    index("expenses_vehicle_occurred_idx").on(t.vehicleId, t.occurredAt),
    check("expenses_amount_nonnegative", sql`${t.amount} >= 0`),
    check("expenses_litres_nonnegative", sql`${t.litres} IS NULL OR ${t.litres} >= 0`),
    ...orgPolicies("expenses", t.orgId, { delete: "member" }),
  ],
).enableRLS();
