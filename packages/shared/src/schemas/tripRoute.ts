import { z } from "zod";
import { GPS_THRESHOLDS } from "../tokens";
import { auditFields, idSchema } from "./common";

/** `[lng, lat, tOffsetMs, accuracyM]`: offset from the trip start, metres. */
export const routePointSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().int().min(0),
  z.number().int().min(0),
]);
export type RoutePointInput = z.infer<typeof routePointSchema>;

/** A continuous stretch of the route; gaps in the signal start a new segment. */
export const routeSegmentSchema = z.array(routePointSchema).min(2);

export const tripRouteSchema = z
  .object({
    ...auditFields,
    tripId: idSchema,
    segments: z.array(routeSegmentSchema).min(1),
    pointCount: z.number().int().min(2).max(GPS_THRESHOLDS.maxRoutePoints),
  })
  .refine(
    (route) =>
      route.pointCount === route.segments.reduce((n, segment) => n + segment.length, 0),
    { path: ["pointCount"], message: "pointCount must equal the number of points" },
  );
export type TripRoute = z.infer<typeof tripRouteSchema>;
