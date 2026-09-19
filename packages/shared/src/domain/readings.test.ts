import { describe, expect, it } from "vitest";
import {
  canVoid,
  currentOdometer,
  distanceTravelled,
  odometerAt,
  readingDeltas,
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

describe("odometerAt", () => {
  it("returns the last valid reading on or before the instant", () => {
    expect(odometerAt(readings, "2026-09-17T08:00:00Z", 0)).toBe(34_209);
    expect(odometerAt(readings, "2026-09-17T07:59:59Z", 0)).toBe(34_000);
  });

  it("falls back to the initial value before the first reading", () => {
    expect(odometerAt(readings, "2026-09-01T00:00:00Z", 500)).toBe(500);
  });
});

describe("distanceTravelled", () => {
  it("sums the increments inside the window from the baseline reading", () => {
    expect(distanceTravelled(readings, "2026-09-10T08:00:00Z", "2026-09-18T23:59:59Z")).toBe(301);
    expect(distanceTravelled(readings, "2026-09-17T08:00:00Z", "2026-09-18T23:59:59Z")).toBe(92);
  });

  it("starts from the first reading in the window when there is no baseline", () => {
    expect(distanceTravelled(readings, "2026-09-01T00:00:00Z", "2026-09-17T23:59:59Z")).toBe(209);
  });

  it("ignores voided readings and odometer changes", () => {
    const withReset: ReadingLike[] = [
      ...readings,
      { id: "reset", value: 12, recordedAt: "2026-09-19T08:00:00Z", odometerReset: true },
      { id: "d", value: 40, recordedAt: "2026-09-20T08:00:00Z" },
    ];
    expect(distanceTravelled(withReset, "2026-09-18T00:00:00Z", "2026-09-21T00:00:00Z")).toBe(92 + 28);
  });

  it("is zero outside the readings", () => {
    expect(distanceTravelled(readings, "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z")).toBe(0);
    expect(distanceTravelled([], "2026-09-01T00:00:00Z", "2026-09-30T00:00:00Z")).toBe(0);
  });
});

describe("readingDeltas", () => {
  it("gives each valid reading its increment over the previous one", () => {
    const withReset: ReadingLike[] = [
      ...readings,
      { id: "reset", value: 12, recordedAt: "2026-09-19T08:00:00Z", odometerReset: true },
    ];
    const deltas = readingDeltas(withReset);
    expect(deltas.get("a")).toBeNull();
    expect(deltas.get("b")).toBe(209);
    expect(deltas.get("c")).toBe(92);
    expect(deltas.get("reset")).toBeNull();
    expect(deltas.has("void")).toBe(false);
  });
});

describe("canVoid", () => {
  it("requires a reason and a reading that is not already voided", () => {
    expect(canVoid(first, "wrong photo")).toBe(true);
    expect(canVoid(first, "  ")).toBe(false);
    expect(canVoid(voided, "twice")).toBe(false);
  });
});
