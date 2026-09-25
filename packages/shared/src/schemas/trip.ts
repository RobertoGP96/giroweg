import { z } from "zod";
import { auditFields, idSchema, timestampSchema } from "./common";
import { readingValueSchema } from "./reading";
import { routeSegmentSchema } from "./tripRoute";

export const tripSchema = z
  .object({
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
  })
  .refine((trip) => trip.endReadingId === null || trip.endedAt !== null, {
    path: ["endedAt"],
    message: "An ended trip needs its end time",
  });
export type Trip = z.infer<typeof tripSchema>;

/** Starting a trip records the odometer at departure. */
export const tripStartInputSchema = z.object({
  vehicleId: idSchema,
  value: readingValueSchema,
  recordedAt: timestampSchema,
});
export type TripStartInput = z.input<typeof tripStartInputSchema>;

/**
 * Ending a trip records the odometer at arrival together with what the GPS
 * measured. `gpsDistance` is in the vehicle unit; `segments` is the route
 * already filtered and simplified on the device.
 */
export const tripEndInputSchema = z.object({
  tripId: idSchema,
  value: readingValueSchema,
  recordedAt: timestampSchema,
  source: z.enum(["trip", "manual"]),
  gpsDistance: z.number().min(0).nullable(),
  pauses: z.number().int().min(0).default(0),
  pausedSeconds: z.number().int().min(0).default(0),
  reason: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .default(null)
    .transform((reason) => (reason === "" ? null : reason)),
  segments: z.array(routeSegmentSchema).default([]),
});
export type TripEndInput = z.input<typeof tripEndInputSchema>;
