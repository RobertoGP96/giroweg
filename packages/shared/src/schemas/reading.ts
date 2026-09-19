import { z } from "zod";
import { auditFields, idSchema, timestampSchema } from "./common";

export const readingSourceSchema = z.enum(["manual", "ocr", "trip"]);
export type ReadingSource = z.infer<typeof readingSourceSchema>;

/** numeric(10,1): one decimal. */
export const readingValueSchema = z
  .number()
  .min(0)
  .max(999_999_999.9)
  .multipleOf(0.1);

export const readingSchema = z.object({
  ...auditFields,
  vehicleId: idSchema,
  value: readingValueSchema,
  recordedAt: timestampSchema,
  source: readingSourceSchema,
  photoPath: z.string().nullable(),
  note: z.string().trim().max(500).nullable(),
  createdBy: z.string().min(1),
  voidedAt: timestampSchema.nullable(),
  voidReason: z.string().trim().max(300).nullable(),
  /** Explicit odometer change (domain rule 2 exception); requires a note. */
  odometerReset: z.boolean().default(false),
});
export type Reading = z.infer<typeof readingSchema>;

export const readingInputSchema = z
  .object({
    vehicleId: idSchema,
    value: readingValueSchema,
    recordedAt: timestampSchema,
    source: readingSourceSchema,
    note: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .default(null)
      .transform((note) => (note === "" ? null : note)),
    odometerReset: z.boolean().default(false),
  })
  .refine((input) => !input.odometerReset || input.note !== null, {
    message: "An odometer change needs a note explaining it",
    path: ["note"],
  });
/** What callers pass (defaults optional); the parsed shape is `z.output`. */
export type ReadingInput = z.input<typeof readingInputSchema>;

/** Readings are never edited: they are voided with a reason (domain rule 1). */
export const voidReadingSchema = z.object({
  readingId: idSchema,
  reason: z.string().trim().min(3).max(300),
});
export type VoidReadingInput = z.infer<typeof voidReadingSchema>;
