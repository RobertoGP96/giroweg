import { describe, expect, it } from "vitest";
import { GPS_THRESHOLDS } from "../tokens";
import { routeSegmentSchema, tripRouteSchema } from "./tripRoute";

const id = "018f3c2e-7b8a-7c3d-9e4f-1a2b3c4d5e6f";
const now = "2026-09-25T10:00:00.000Z";

const base = {
  id,
  orgId: id,
  createdAt: now,
  updatedAt: now,
  syncedAt: null,
  tripId: id,
};

const segmentA = [
  [-3.7038, 40.4168, 0, 5],
  [-3.7036, 40.417, 5000, 4],
];
const segmentB = [
  [-3.7, 40.42, 200_000, 6],
  [-3.699, 40.421, 205_000, 6],
  [-3.698, 40.422, 210_000, 7],
];

describe("tripRouteSchema", () => {
  it("accepts a valid two-segment route", () => {
    const result = tripRouteSchema.safeParse({
      ...base,
      segments: [segmentA, segmentB],
      pointCount: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a segment with a single point", () => {
    expect(routeSegmentSchema.safeParse([segmentA[0]]).success).toBe(false);
    expect(
      tripRouteSchema.safeParse({ ...base, segments: [[segmentA[0]]], pointCount: 1 }).success,
    ).toBe(false);
  });

  it("rejects a pointCount that does not match the segments", () => {
    const result = tripRouteSchema.safeParse({
      ...base,
      segments: [segmentA, segmentB],
      pointCount: 4,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["pointCount"]);
    }
  });

  it("rejects a pointCount above the cap", () => {
    const result = tripRouteSchema.safeParse({
      ...base,
      segments: [segmentA],
      pointCount: GPS_THRESHOLDS.maxRoutePoints + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a longitude out of range", () => {
    const result = tripRouteSchema.safeParse({
      ...base,
      segments: [
        [
          [181, 40, 0, 5],
          [-3.7, 40.4, 1000, 5],
        ],
      ],
      pointCount: 2,
    });
    expect(result.success).toBe(false);
  });
});
