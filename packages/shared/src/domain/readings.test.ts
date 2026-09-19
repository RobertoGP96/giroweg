import { describe, expect, it } from "vitest";
import {
  canVoid,
  currentOdometer,
  validateReading,
  type ReadingLike,
} from "./readings";

const first: ReadingLike = { id: "a", value: 34_000, recordedAt: "2026-09-10T08:00:00Z" };
const voided: ReadingLike = {
  id: "void",
  value: 90_000,
  recordedAt: "2026-09-18T14:00:00Z",
  voidedAt: "2026-09-18T14:05:00Z",
};
const readings: ReadingLike[] = [
  first,
  { id: "b", value: 34_209, recordedAt: "2026-09-17T08:00:00Z" },
  { id: "c", value: 34_301, recordedAt: "2026-09-18T13:00:00Z" },
  voided,
];

describe("validateReading", () => {
  it("accepts a value between the previous and next valid readings", () => {
    const result = validateReading(
      { value: 34_250, recordedAt: "2026-09-18T09:00:00Z" },
      readings,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a value below the previous valid reading", () => {
    const result = validateReading(
      { value: 34_100, recordedAt: "2026-09-18T09:00:00Z" },
      readings,
    );
    expect(result).toMatchObject({ ok: false, reason: "below_previous" });
    if (!result.ok && result.reason === "below_previous") {
      expect(result.previous.id).toBe("b");
    }
  });

  it("rejects a value above the next valid reading", () => {
    const result = validateReading(
      { value: 34_400, recordedAt: "2026-09-18T09:00:00Z" },
      readings,
    );
    expect(result).toMatchObject({ ok: false, reason: "above_next" });
  });

  it("ignores voided readings", () => {
    const result = validateReading(
      { value: 34_350, recordedAt: "2026-09-19T08:00:00Z" },
      readings,
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows an explicit odometer change below the previous reading", () => {
    const result = validateReading(
      { value: 12, recordedAt: "2026-09-19T08:00:00Z", odometerReset: true },
      readings,
    );
    expect(result).toEqual({ ok: true });
  });

  it("does not bound a reading by a later odometer change", () => {
    const withReset: ReadingLike[] = [
      ...readings,
      { id: "reset", value: 12, recordedAt: "2026-09-20T08:00:00Z", odometerReset: true },
    ];
    const result = validateReading(
      { value: 34_350, recordedAt: "2026-09-19T08:00:00Z" },
      withReset,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects negative and non finite values", () => {
    expect(
      validateReading({ value: -1, recordedAt: "2026-09-19T08:00:00Z" }, []),
    ).toMatchObject({ reason: "negative" });
    expect(
      validateReading({ value: Number.NaN, recordedAt: "2026-09-19T08:00:00Z" }, []),
    ).toMatchObject({ reason: "not_finite" });
  });
});

describe("currentOdometer", () => {
  it("derives the current value from the latest valid reading", () => {
    expect(currentOdometer(readings, 0)).toBe(34_301);
  });

  it("falls back to the initial value without readings", () => {
    expect(currentOdometer([], 1_200)).toBe(1_200);
  });
});

describe("canVoid", () => {
  it("requires a reason and a reading that is not already voided", () => {
    expect(canVoid(first, "wrong photo")).toBe(true);
    expect(canVoid(first, "  ")).toBe(false);
    expect(canVoid(voided, "twice")).toBe(false);
  });
});
