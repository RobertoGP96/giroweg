import { haversineMeters, type GpsFix } from "@giroweg/shared/domain";
import { GPS_THRESHOLDS } from "@giroweg/shared/tokens";
import { describe, expect, it } from "vitest";
import {
  applyFix,
  elapsedSeconds,
  finishTracking,
  freezeTracking,
  pauseTracking,
  pausedSeconds,
  resumeTracking,
  startTracking,
  trackingStateSchema,
  unfreezeTracking,
  type TrackingState,
} from "./tracking";

const START_MS = Date.UTC(2026, 8, 25, 8, 0, 0);
const ORIGIN = { lng: -3.7038, lat: 40.4168 };
/** Degrees of longitude per metre at the origin latitude. */
const LNG_PER_M = 1 / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180));

const start = (unit: "km" | "mi" = "km"): TrackingState =>
  startTracking({
    tripId: "trip-1",
    vehicleId: "vehicle-1",
    unit,
    startReadingId: "reading-1",
    startValue: 34_218,
    startedAt: new Date(START_MS).toISOString(),
    startedAtMs: START_MS,
  });

/** A fix `meters` east of the origin, `seconds` after the start. */
const fixAt = (meters: number, seconds: number, extra: Partial<GpsFix> = {}): GpsFix => ({
  lng: ORIGIN.lng + meters * LNG_PER_M,
  lat: ORIGIN.lat,
  t: START_MS + seconds * 1000,
  accuracy: 6,
  speed: null,
  ...extra,
});

const ride = (state: TrackingState, fixes: GpsFix[]): TrackingState =>
  fixes.reduce((current, fix) => applyFix(current, fix), state);

describe("startTracking", () => {
  it("opens an empty segment and searches for signal", () => {
    const state = start();
    expect(state.segments).toEqual([[]]);
    expect(state.gps).toBe("searching");
    expect(state.status).toBe("tracking");
    expect(state.distanceMeters).toBe(0);
    expect(state.acceptedFixes).toBe(0);
    expect(trackingStateSchema.safeParse(state).success).toBe(true);
  });
});

describe("applyFix", () => {
  it("accumulates the distance of a straight ride and reports a good signal", () => {
    const fixes = [fixAt(0, 0), fixAt(50, 5), fixAt(100, 10)];
    const state = ride(start(), fixes);
    const a = fixes[0];
    const b = fixes[1];
    const c = fixes[2];
    if (!a || !b || !c) throw new Error("fixture");
    const expected = haversineMeters(a, b) + haversineMeters(b, c);
    expect(state.distanceMeters).toBeCloseTo(expected, 6);
    expect(state.acceptedFixes).toBe(3);
    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]).toHaveLength(3);
    expect(state.gps).toBe("ok");
    expect(state.speedMps).toBeCloseTo(10, 0);
  });

  it("rejects a duplicate timestamp as stale without changing the route", () => {
    const before = ride(start(), [fixAt(0, 0), fixAt(50, 5)]);
    const after = applyFix(before, fixAt(80, 5));
    expect(after.rejected.stale).toBe(1);
    expect(after.distanceMeters).toBe(before.distanceMeters);
    expect(after.segments).toEqual(before.segments);
    expect(after.lastFix).toBe(before.lastFix);
  });

  it("counts inaccurate fixes and keeps the last accuracy", () => {
    const state = applyFix(ride(start(), [fixAt(0, 0)]), fixAt(50, 5, { accuracy: 80 }));
    expect(state.rejected.inaccurate).toBe(1);
    expect(state.lastAccuracyM).toBe(80);
    expect(state.acceptedFixes).toBe(1);
  });

  it("ignores fixes while paused; resume opens a new segment with no distance", () => {
    const tracking = ride(start(), [fixAt(0, 0), fixAt(50, 5)]);
    const paused = pauseTracking(tracking, START_MS + 6000);
    const ignored = applyFix(paused, fixAt(100, 10));
    expect(ignored).toBe(paused);

    const resumed = resumeTracking(paused, START_MS + 20_000);
    expect(resumed.status).toBe("tracking");
    expect(resumed.segments).toHaveLength(2);
    expect(resumed.lastFix).toBeNull();

    const after = applyFix(resumed, fixAt(300, 25));
    expect(after.distanceMeters).toBe(tracking.distanceMeters);
    expect(after.segments[1]).toHaveLength(1);
    expect(after.acceptedFixes).toBe(3);
  });

  it("opens a new segment after a signal gap and accumulates the gap time", () => {
    const gapSeconds = GPS_THRESHOLDS.maxGapMs / 1000 + 30;
    const before = ride(start(), [fixAt(0, 0), fixAt(50, 5)]);
    const after = applyFix(before, fixAt(1000, 5 + gapSeconds));
    expect(after.segments).toHaveLength(2);
    expect(after.segments[1]).toHaveLength(1);
    expect(after.distanceMeters).toBe(before.distanceMeters);
    expect(after.gaps).toBe(1);
    expect(after.gapMs).toBe(gapSeconds * 1000);
    expect(after.acceptedFixes).toBe(3);
  });

  it("caps the live buffer by simplifying the last segment without touching the distance", () => {
    const limit = GPS_THRESHOLDS.liveBufferPoints;
    let state = start();
    // A 2 m zig-zag (under the 5 m tolerance) so simplification has points to drop.
    for (let i = 0; i < limit; i += 1) {
      state = applyFix(state, {
        lng: ORIGIN.lng + i * 20 * LNG_PER_M,
        lat: ORIGIN.lat + (i % 2 === 0 ? 0 : 2 / 111_320),
        t: START_MS + i * 1000,
        accuracy: 6,
        speed: null,
      });
    }
    const distanceBefore = state.distanceMeters;
    expect(state.segments[0]?.length).toBe(limit);
    state = applyFix(state, fixAt(limit * 20, limit));
    expect(state.segments[0]?.length).toBeLessThan(limit);
    expect(state.distanceMeters).toBeGreaterThan(distanceBefore);
  });
});

describe("elapsed and paused time", () => {
  it("derives both from the timestamps", () => {
    let state = ride(start(), [fixAt(0, 0)]);
    state = pauseTracking(state, START_MS + 60_000);
    expect(elapsedSeconds(state, START_MS + 75_000)).toBe(60);
    expect(pausedSeconds(state, START_MS + 75_000)).toBe(15);
    state = resumeTracking(state, START_MS + 90_000);
    expect(elapsedSeconds(state, START_MS + 120_000)).toBe(90);
    expect(pausedSeconds(state, START_MS + 120_000)).toBe(30);
    expect(state.pauses).toBe(1);
  });

  it("never goes negative when the clock is behind the start", () => {
    const state = start();
    expect(elapsedSeconds(state, START_MS - 5000)).toBe(0);
    expect(pausedSeconds(pauseTracking(state, START_MS), START_MS - 5000)).toBe(0);
  });
});

describe("freeze / unfreeze", () => {
  it("ignores fixes while ending and accepts them again after unfreeze", () => {
    const tracking = ride(start(), [fixAt(0, 0)]);
    const frozen = freezeTracking(tracking);
    expect(frozen.status).toBe("ending");
    expect(applyFix(frozen, fixAt(50, 5))).toBe(frozen);
    const back = unfreezeTracking(frozen);
    expect(back.status).toBe("tracking");
    expect(applyFix(back, fixAt(50, 5)).acceptedFixes).toBe(2);
  });
});

describe("finishTracking", () => {
  it("ends after the start even when the clock has not moved", () => {
    const summary = finishTracking(start(), START_MS - 10);
    expect(new Date(summary.endedAt).getTime()).toBe(START_MS + 1000);
    expect(summary.recordedAt).toBe(summary.endedAt);
  });

  it("rounds the GPS distance to a tenth in km and in mi", () => {
    const fixes = [fixAt(0, 0), fixAt(500, 50), fixAt(1234, 120)];
    const km = finishTracking(ride(start("km"), fixes), START_MS + 130_000);
    expect(km.gpsDistance).toBe(1.2);
    expect(km.suggestedValue).toBe(34_219);
    const mi = finishTracking(ride(start("mi"), fixes), START_MS + 130_000);
    expect(mi.gpsDistance).toBe(0.8);
    expect(mi.suggestedValue).toBe(34_218);
    expect(km.distanceMeters).toBeGreaterThan(1225);
    expect(km.distanceMeters).toBeLessThan(1245);
  });

  it("has no distance or suggestion with fewer than two accepted fixes", () => {
    const summary = finishTracking(ride(start(), [fixAt(0, 0)]), START_MS + 10_000);
    expect(summary.gpsDistance).toBeNull();
    expect(summary.suggestedValue).toBeNull();
    expect(summary.segments).toEqual([]);
    expect(summary.pointCount).toBe(0);
  });

  it("drops segments with fewer than two points and counts the rest", () => {
    let state = ride(start(), [fixAt(0, 0), fixAt(50, 5), fixAt(100, 10)]);
    state = resumeTracking(pauseTracking(state, START_MS + 11_000), START_MS + 20_000);
    state = applyFix(state, fixAt(200, 25));
    const summary = finishTracking(state, START_MS + 30_000);
    expect(summary.segments).toHaveLength(1);
    expect(summary.pointCount).toBe(summary.segments.reduce((n, s) => n + s.length, 0));
    expect(summary.pointCount).toBeGreaterThanOrEqual(2);
    expect(summary.pauses).toBe(1);
    expect(summary.pausedSeconds).toBe(9);
  });

  it("includes an open pause in pausedSeconds", () => {
    const state = pauseTracking(ride(start(), [fixAt(0, 0)]), START_MS + 10_000);
    expect(finishTracking(state, START_MS + 25_000).pausedSeconds).toBe(15);
  });
});
