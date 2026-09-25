import { describe, expect, it } from "vitest";
import {
  acceptFix,
  capRoutePoints,
  decimalsOf,
  haversineMeters,
  isDistanceUnit,
  metersToUnit,
  routeBounds,
  routeDistanceMeters,
  segmentsDistanceMeters,
  simplifyRoute,
  suggestedEndReading,
  toRoutePoint,
  type GpsFix,
  type RoutePoint,
} from "./gps";

/** Metres per degree of latitude; longitude at the equator is the same. */
const M_PER_DEG = 111_195;

const fix = (overrides: Partial<GpsFix> = {}): GpsFix => ({
  lng: 0,
  lat: 0,
  t: 1_000_000,
  accuracy: 5,
  speed: null,
  ...overrides,
});

/** A fix `meters` north of the origin, `seconds` after `t0`. */
const northOf = (meters: number, seconds: number, accuracy = 5): GpsFix =>
  fix({ lat: meters / M_PER_DEG, t: 1_000_000 + seconds * 1000, accuracy });

const point = (lng: number, lat: number, t = 0, acc = 5): RoutePoint => [lng, lat, t, acc];

describe("haversineMeters", () => {
  it("measures one degree of latitude as about 111 195 m", () => {
    const d = haversineMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 1 });
    expect(Math.abs(d - M_PER_DEG) / M_PER_DEG).toBeLessThan(0.005);
  });

  it("is symmetric and zero for identical points", () => {
    const a = { lng: -3.7, lat: 40.4 };
    const b = { lng: 2.17, lat: 41.38 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
    expect(haversineMeters(a, a)).toBe(0);
  });
});

describe("acceptFix", () => {
  const origin = fix();

  it("accepts the first fix with a zero step", () => {
    expect(acceptFix(null, origin)).toEqual({ accept: true, stepMeters: 0, dtMs: 0, gap: false });
  });

  it("rejects non-finite or out-of-range coordinates", () => {
    expect(acceptFix(null, fix({ lat: Number.NaN }))).toEqual({
      accept: false,
      reason: "not_finite",
    });
    expect(acceptFix(null, fix({ lat: 91 }))).toEqual({ accept: false, reason: "not_finite" });
  });

  it("rejects inaccurate fixes", () => {
    expect(acceptFix(null, fix({ accuracy: 31 }))).toEqual({
      accept: false,
      reason: "inaccurate",
    });
  });

  it("rejects a fix that is not newer than the previous one", () => {
    expect(acceptFix(origin, northOf(50, 0))).toEqual({ accept: false, reason: "stale" });
  });

  it("rejects steps shorter than the minimum or the accuracy", () => {
    expect(acceptFix(origin, northOf(8, 5, 5))).toEqual({ accept: false, reason: "too_close" });
    expect(acceptFix(origin, northOf(12, 5, 15))).toEqual({
      accept: false,
      reason: "too_close",
    });
  });

  it("accepts a 20 m step", () => {
    const decision = acceptFix(origin, northOf(20, 5));
    expect(decision.accept).toBe(true);
    if (decision.accept) {
      expect(decision.stepMeters).toBeCloseTo(20, 0);
      expect(decision.dtMs).toBe(5000);
      expect(decision.gap).toBe(false);
    }
  });

  it("rejects impossible speeds", () => {
    expect(acceptFix(origin, northOf(500, 1))).toEqual({ accept: false, reason: "too_fast" });
    expect(acceptFix(origin, northOf(500, 10)).accept).toBe(true);
  });

  it("flags a gap after a long silence", () => {
    const late = acceptFix(origin, northOf(1000, 300));
    expect(late.accept && late.gap).toBe(true);
    const soon = acceptFix(origin, northOf(1000, 60));
    expect(soon.accept && !soon.gap).toBe(true);
  });
});

describe("toRoutePoint", () => {
  it("rounds coordinates to 6 decimals and clamps the offset", () => {
    const p = toRoutePoint(
      fix({ lng: -3.70379123456, lat: 40.41677654321, t: 999_500, accuracy: 4.6 }),
      1_000_000,
    );
    expect(p).toEqual([-3.703791, 40.416777, 0, 5]);
    expect(toRoutePoint(fix({ t: 1_001_234.6 }), 1_000_000)[2]).toBe(1235);
  });
});

describe("route distances", () => {
  it("sums consecutive distances and returns 0 for short routes", () => {
    const line = [point(0, 0), point(0, 1), point(0, 2)];
    expect(routeDistanceMeters(line)).toBeCloseTo(2 * M_PER_DEG, -3);
    expect(routeDistanceMeters([point(0, 0)])).toBe(0);
    expect(routeDistanceMeters([])).toBe(0);
  });

  it("adds the segments without bridging the gaps", () => {
    const a = [point(0, 0), point(0, 1)];
    const b = [point(10, 0), point(10, 1)];
    expect(segmentsDistanceMeters([a, b])).toBeCloseTo(2 * M_PER_DEG, -3);
    expect(segmentsDistanceMeters([])).toBe(0);
  });
});

describe("simplifyRoute", () => {
  it("collapses collinear points to the endpoints", () => {
    const line = Array.from({ length: 100 }, (_, i) => point(0, i * 0.001, i * 1000));
    const simplified = simplifyRoute(line, 5);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toBe(line[0]);
    expect(simplified[1]).toBe(line[99]);
  });

  it("keeps the corners of a square and the endpoints", () => {
    const square = [
      point(0, 0),
      point(0.0005, 0),
      point(0.001, 0),
      point(0.001, 0.0005),
      point(0.001, 0.001),
      point(0.0005, 0.001),
      point(0, 0.001),
      point(0, 0.0005),
    ];
    const simplified = simplifyRoute(square, 5);
    expect(simplified).toEqual([
      point(0, 0),
      point(0.001, 0),
      point(0.001, 0.001),
      point(0, 0.001),
      point(0, 0.0005),
    ]);
    for (const kept of simplified) expect(square).toContain(kept);
  });

  it("returns short inputs and tolerance 0 unchanged", () => {
    const two = [point(0, 0), point(1, 1)];
    const copy = simplifyRoute(two);
    expect(copy).toEqual(two);
    expect(copy).not.toBe(two);
    const line = Array.from({ length: 10 }, (_, i) => point(0, i * 0.001));
    expect(simplifyRoute(line, 0)).toEqual(line);
  });
});

describe("capRoutePoints", () => {
  it("brings a noisy route under the cap keeping the endpoints", () => {
    let seed = 42;
    const noise = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return (seed / 2_147_483_648 - 0.5) * 0.002;
    };
    const noisy = Array.from({ length: 10_000 }, (_, i) =>
      point(i * 0.0001 + noise(), noise(), i * 1000),
    );
    const capped = capRoutePoints(noisy, 3000);
    expect(capped.length).toBeLessThanOrEqual(3000);
    expect(capped.length).toBeGreaterThan(1);
    expect(capped[0]).toBe(noisy[0]);
    expect(capped[capped.length - 1]).toBe(noisy[9999]);
  });

  it("leaves a route already under the cap alone", () => {
    const two = [point(0, 0), point(1, 1)];
    expect(capRoutePoints(two, 10)).toEqual(two);
  });
});

describe("routeBounds", () => {
  it("is null without points", () => {
    expect(routeBounds([])).toBeNull();
    expect(routeBounds([[]])).toBeNull();
  });

  it("spans every segment with mixed-sign coordinates", () => {
    const bounds = routeBounds([
      [point(-3.7, 40.4), point(-3.6, 40.5)],
      [point(2.1, -33.9), point(2.2, -33.8)],
    ]);
    expect(bounds).toEqual({ sw: { lng: -3.7, lat: -33.9 }, ne: { lng: 2.2, lat: 40.5 } });
  });
});

describe("units", () => {
  it("converts metres to the vehicle unit", () => {
    expect(metersToUnit(1609.344, "mi")).toBeCloseTo(1, 9);
    expect(metersToUnit(1500, "km")).toBe(1.5);
    expect(isDistanceUnit("km")).toBe(true);
    expect(isDistanceUnit("h")).toBe(false);
  });

  it("reports the decimals of a reading", () => {
    expect(decimalsOf(34_218)).toBe(0);
    expect(decimalsOf(34_218.4)).toBe(1);
  });
});

describe("suggestedEndReading", () => {
  it("floors to the precision of the start reading", () => {
    expect(suggestedEndReading(34_218, 12_340, "km")).toBe(34_230);
    expect(suggestedEndReading(34_218.4, 12_340, "km")).toBe(34_230.7);
    expect(suggestedEndReading(1000, 1609.344, "mi")).toBe(1001);
  });

  it("is null without a GPS distance and never below the start", () => {
    expect(suggestedEndReading(34_218, null, "km")).toBeNull();
    expect(suggestedEndReading(34_218, 0, "km")).toBe(34_218);
    expect(suggestedEndReading(34_218.4, 20, "km")).toBe(34_218.4);
  });
});
