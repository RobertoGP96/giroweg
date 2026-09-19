import { describe, expect, it } from "vitest";
import { canChangeUnit, convertDistance } from "./units";

describe("convertDistance", () => {
  it("converts km to mi and back only for display", () => {
    expect(convertDistance(1.609344, "km", "mi")).toBeCloseTo(1);
    expect(convertDistance(1, "mi", "km")).toBeCloseTo(1.609344);
    expect(convertDistance(42, "km", "km")).toBe(42);
  });

  it("refuses to convert hours", () => {
    expect(() => convertDistance(1, "h", "km")).toThrow();
  });
});

describe("canChangeUnit", () => {
  it("is immutable once the vehicle has a reading", () => {
    expect(canChangeUnit(0)).toBe(true);
    expect(canChangeUnit(1)).toBe(false);
  });
});
