import { z } from "zod";
import { auditFields, idSchema, timestampSchema } from "./common";

export const tripSchema = z.object({
  ...auditFields,
  vehicleId: idSchema,
  startReadingId: idSchema,
  endReadingId: idSchema.nullable(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  /** Distance measured by GPS in the vehicle unit. */
  gpsDistance: z.number().min(0).nullable(),
  reason: z.string().trim().max(200).nullable(),
  stops: z.number().int().min(0).default(0),
  pauses: z.number().int().min(0).default(0),
  pausedSeconds: z.number().int().min(0).default(0),
});
export type Trip = z.infer<typeof tripSchema>;
