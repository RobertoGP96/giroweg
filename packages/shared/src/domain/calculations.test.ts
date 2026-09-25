import { describe, expect, it } from "vitest";
import {
  compareGpsWithOdometer,
  costPerDistance,
  fuelEfficiency,
  maintenanceProgress,
  tripDistance,
} from "./calculations";

describe("tripDistance", () => {
  it("is the difference between readings and never negative", () => {
    expect(tripDistance(34_218, 34_301)).toBe(83);
    expect(tripDistance(10, 5)).toBe(0);
  });
});

describe("compareGpsWithOdometer", () => {
  it("flags differences above 3 %", () => {
    expect(compareGpsWithOdometer(83, 81.6).withinMargin).toBe(true);
    expect(compareGpsWithOdometer(100, 90).withinMargin).toBe(false);
  });

  it("handles a zero odometer distance", () => {
    expect(compareGpsWithOdometer(0, 0)).toEqual({
      difference: 0,
      ratio: 0,
      withinMargin: true,
    });
    expect(compareGpsWithOdometer(0, 12)).toEqual({
      difference: 12,
      ratio: 1,
      withinMargin: false,
    });
  });
});

describe("fuel and cost", () => {
  it("computes efficiency and cost per distance", () => {
    expect(fuelEfficiency(543, 17.4)).toBeCloseTo(31.2, 1);
    expect(fuelEfficiency(10, 0)).toBeNull();
    expect(costPerDistance(412.5, 543)).toBeCloseTo(0.76, 2);
    expect(costPerDistance(10, 0)).toBeNull();
  });
});

describe("maintenanceProgress", () => {
  it("reports remaining units and urgency above 90 %", () => {
    const oil = maintenanceProgress(34_301, 31_500, 3_000);
    expect(oil.remaining).toBe(199);
    expect(oil.urgent).toBe(true);
    const tyre = maintenanceProgress(34_301, 31_000, 6_000);
    expect(tyre.urgent).toBe(false);
    expect(tyre.progress).toBeCloseTo(0.55, 2);
  });
});
