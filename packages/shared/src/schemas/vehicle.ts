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

/** Input for creating or editing a vehicle. Ids and timestamps are set by the repository. */
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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((text) => (text === "" ? null : text));

/**
 * What the vehicle form collects: every field as text, as the inputs hold it.
 * Parsing yields a `VehicleInput`. Issue messages are keys the UI translates.
 */
export const vehicleFormSchema = z.object({
  type: vehicleTypeSchema,
  name: z.string().trim().min(1, "required").max(80, "tooLong"),
  brand: optionalText(60),
  model: optionalText(60),
  year: z
    .string()
    .trim()
    .transform((text, ctx) => {
      if (text === "") return null;
      const year = Number(text);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        ctx.addIssue({ code: "custom", message: "year" });
        return z.NEVER;
      }
      return year;
    }),
  plate: optionalText(16).transform((plate) => (plate === null ? null : plate.toUpperCase())),
  unit: unitSchema,
  initialValue: z
    .string()
    .trim()
    .transform((text, ctx) => {
      if (text === "") return 0;
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        ctx.addIssue({ code: "custom", message: "initialValue" });
        return z.NEVER;
      }
      return Math.round(value * 10) / 10;
    }),
});
export type VehicleFormValues = z.input<typeof vehicleFormSchema>;
export type VehicleFormOutput = z.output<typeof vehicleFormSchema>;
