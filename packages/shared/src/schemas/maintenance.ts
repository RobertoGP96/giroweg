import { z } from "zod";
import { auditFields, idSchema, timestampSchema } from "./common";

/** A rule fires every N units of distance or every N days. */
export const maintenanceRuleSchema = z
  .object({
    ...auditFields,
    vehicleId: idSchema,
    name: z.string().trim().min(1).max(80),
    everyUnits: z.number().positive().nullable(),
    everyDays: z.number().int().positive().nullable(),
    /** Remind this many units before the due value. */
    remindUnitsBefore: z.number().min(0).default(300),
    active: z.boolean().default(true),
  })
  .refine((rule) => rule.everyUnits !== null || rule.everyDays !== null, {
    message: "A rule needs a distance or a time interval",
  });
export type MaintenanceRule = z.infer<typeof maintenanceRuleSchema>;

export const maintenanceEventSchema = z.object({
  ...auditFields,
  ruleId: idSchema,
  vehicleId: idSchema,
  readingId: idSchema.nullable(),
  /** Odometer value when the service was done. */
  atValue: z.number().min(0),
  doneAt: timestampSchema,
  note: z.string().trim().max(300).nullable(),
});
export type MaintenanceEvent = z.infer<typeof maintenanceEventSchema>;
