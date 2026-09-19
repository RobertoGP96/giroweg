import { z } from "zod";
import { UNITS } from "../domain/units";
import { auditFields, timestampSchema } from "./common";

export const VEHICLE_TYPES = [
  "motorcycle",
  "car",
  "pickup",
  "van",
  "truck",
  "bicycle",
  "machinery",
] as const;

export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const unitSchema = z.enum(UNITS);

export const vehicleSchema = z.object({
  ...auditFields,
  type: vehicleTypeSchema,
  name: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(60).nullable(),
  model: z.string().trim().max(60).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  plate: z.string().trim().max(16).nullable(),
  photoPath: z.string().nullable(),
  unit: unitSchema,
  initialValue: z.number().min(0),
  archivedAt: timestampSchema.nullable(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

/** Form input for creating a vehicle. Ids and timestamps are set by the repository. */
export const vehicleInputSchema = vehicleSchema.pick({
  type: true,
  name: true,
  brand: true,
  model: true,
  year: true,
  plate: true,
  unit: true,
  initialValue: true,
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;
