import { describe, expect, it } from "vitest";
import { tripEndInputSchema, tripSchema, tripStartInputSchema } from "./trip";

const id = "018f3c2e-7b8a-7c3d-9e4f-1a2b3c4d5e6f";
const now = "2026-09-25T10:00:00.000Z";

const trip = {
  id,
  orgId: id,
  createdAt: now,
  updatedAt: now,
  syncedAt: null,
  vehicleId: id,
  startReadingId: id,
  endReadingId: null,
  startedAt: now,
  endedAt: null,
  gpsDistance: null,
  reason: null,
};

describe("tripSchema", () => {
  it("accepts an open trip and applies the counter defaults", () => {
    const result = tripSchema.safeParse(trip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stops).toBe(0);
      expect(result.data.pauses).toBe(0);
      expect(result.data.pausedSeconds).toBe(0);
    }
  });

  it("rejects an end reading without an end time", () => {
    const result = tripSchema.safeParse({ ...trip, endReadingId: id });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endedAt"]);
    }
    expect(tripSchema.safeParse({ ...trip, endReadingId: id, endedAt: now }).success).toBe(true);
  });
});

describe("tripStartInputSchema", () => {
  it("requires a one-decimal reading value", () => {
    expect(tripStartInputSchema.safeParse({ vehicleId: id, value: 34_218, recordedAt: now }).success)
      .toBe(true);
    expect(
      tripStartInputSchema.safeParse({ vehicleId: id, value: 34_218.25, recordedAt: now }).success,
    ).toBe(false);
  });
});

describe("tripEndInputSchema", () => {
  it("applies defaults and turns an empty reason into null", () => {
    const result = tripEndInputSchema.safeParse({
      tripId: id,
      value: 34_230,
      recordedAt: now,
      source: "trip",
      gpsDistance: 12.3,
      reason: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pauses).toBe(0);
      expect(result.data.pausedSeconds).toBe(0);
      expect(result.data.reason).toBeNull();
      expect(result.data.segments).toEqual([]);
    }
  });

  it("validates the segments it receives", () => {
    const valid = tripEndInputSchema.safeParse({
      tripId: id,
      value: 34_230,
      recordedAt: now,
      source: "manual",
      gpsDistance: null,
      segments: [
        [
          [-3.7, 40.4, 0, 5],
          [-3.69, 40.41, 1000, 5],
        ],
      ],
    });
    expect(valid.success).toBe(true);
    const invalid = tripEndInputSchema.safeParse({
      tripId: id,
      value: 34_230,
      recordedAt: now,
      source: "ocr",
      gpsDistance: null,
    });
    expect(invalid.success).toBe(false);
  });
});
