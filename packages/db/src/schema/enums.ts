import { pgEnum } from "drizzle-orm/pg-core";
import { UNITS, VEHICLE_TYPES } from "@giroweg/shared";

/** Enum values come from packages/shared so zod and Postgres never drift. */
export const membershipRole = pgEnum("membership_role", ["owner", "admin", "member"]);
export const vehicleType = pgEnum("vehicle_type", VEHICLE_TYPES);
export const distanceUnit = pgEnum("distance_unit", UNITS);
export const readingSource = pgEnum("reading_source", ["manual", "ocr", "trip"]);
export const expenseType = pgEnum("expense_type", ["fuel", "toll", "other"]);
