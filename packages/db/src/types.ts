import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  expenses,
  maintenanceEvents,
  maintenanceRules,
  memberships,
  organizations,
  readings,
  trips,
  vehicles,
} from "./schema";

export type OrganizationRow = InferSelectModel<typeof organizations>;
export type MembershipRow = InferSelectModel<typeof memberships>;
export type VehicleRow = InferSelectModel<typeof vehicles>;
export type VehicleInsert = InferInsertModel<typeof vehicles>;
export type ReadingRow = InferSelectModel<typeof readings>;
export type ReadingInsert = InferInsertModel<typeof readings>;
export type TripRow = InferSelectModel<typeof trips>;
export type TripInsert = InferInsertModel<typeof trips>;
export type ExpenseRow = InferSelectModel<typeof expenses>;
export type ExpenseInsert = InferInsertModel<typeof expenses>;
export type MaintenanceRuleRow = InferSelectModel<typeof maintenanceRules>;
export type MaintenanceEventRow = InferSelectModel<typeof maintenanceEvents>;
