/**
 * Pure state machine of a GPS trip in progress. No DOM and no clock: every
 * "now" comes in as an argument so the reducer is deterministic and testable.
 * The store delegates to these functions; the snapshot persists the state.
 */

import {
  acceptFix,
  capRoutePoints,
  metersToUnit,
  roundToTenth,
  simplifyRoute,
  suggestedEndReading,
  toRoutePoint,
  type DistanceUnit,
  type FixDecision,
  type GpsFix,
  type RoutePoint,
} from "@giroweg/shared/domain";
import { routePointSchema } from "@giroweg/shared/schemas";
import { GPS_THRESHOLDS } from "@giroweg/shared/tokens";
import { z } from "zod";

export type TrackingStatus = "tracking" | "paused" | "ending";

export type GpsState = "searching" | "ok" | "weak" | "timeout" | "denied" | "unavailable";

export interface RejectedCounters {
  inaccurate: number;
  tooFast: number;
  stale: number;
  tooClose: number;
}

export interface TrackingState {
  tripId: string;
  vehicleId: string;
  unit: DistanceUnit;
  startReadingId: string;
  startValue: number;
  /** ISO 8601, UTC. */
  startedAt: string;
  startedAtMs: number;
  status: TrackingStatus;
  /** Continuous stretches of accepted points; a signal gap or a pause opens a new one. */
  segments: RoutePoint[][];
  lastFix: GpsFix | null;
  distanceMeters: number;
  acceptedFixes: number;
  rejected: RejectedCounters;
  /** Milliseconds of silence bridged by new segments. */
  gapMs: number;
  gaps: number;
  pauses: number;
  /** Closed pauses only; an open pause is derived from `pauseStartedAtMs`. */
  pausedMs: number;
  pauseStartedAtMs: number | null;
  gps: GpsState;
  lastAccuracyM: number | null;
  /** Smoothed ground speed in m/s. */
  speedMps: number | null;
}

export interface TrackingStartInput {
  tripId: string;
  vehicleId: string;
  unit: DistanceUnit;
  startReadingId: string;
  startValue: number;
  startedAt: string;
  startedAtMs: number;
}

/** Accuracy (metres) at or below which the signal counts as good. */
const GOOD_ACCURACY_M = 10;
/** Weight of the newest sample in the speed moving average. */
const SPEED_SMOOTHING = 0.5;

export const startTracking = (input: TrackingStartInput): TrackingState => ({
  tripId: input.tripId,
  vehicleId: input.vehicleId,
  unit: input.unit,
  startReadingId: input.startReadingId,
  startValue: input.startValue,
  startedAt: input.startedAt,
  startedAtMs: input.startedAtMs,
  status: "tracking",
  segments: [[]],
  lastFix: null,
  distanceMeters: 0,
  acceptedFixes: 0,
  rejected: { inaccurate: 0, tooFast: 0, stale: 0, tooClose: 0 },
  gapMs: 0,
  gaps: 0,
  pauses: 0,
  pausedMs: 0,
  pauseStartedAtMs: null,
  gps: "searching",
  lastAccuracyM: null,
  speedMps: null,
});

type RejectedReason = Exclude<Extract<FixDecision, { accept: false }>["reason"], "not_finite">;

const rejectedKey: Record<RejectedReason, keyof RejectedCounters> = {
  inaccurate: "inaccurate",
  too_fast: "tooFast",
  stale: "stale",
  too_close: "tooClose",
};

const smoothSpeed = (previous: number | null, sample: number | null): number | null => {
  if (sample === null) return previous;
  if (previous === null) return sample;
  return previous + SPEED_SMOOTHING * (sample - previous);
};

/** Replaces the last segment (used both for appends and for the live cap). */
const withLastSegment = (segments: RoutePoint[][], last: RoutePoint[]): RoutePoint[][] => {
  if (segments.length === 0) return [last];
  return [...segments.slice(0, -1), last];
};

/**
 * Feeds a raw position into the trip. Rejected fixes only touch the counters
 * and the last accuracy; accepted ones extend the route and the distance.
 */
export const applyFix = (state: TrackingState, fix: GpsFix): TrackingState => {
  if (state.status !== "tracking") return state;
  const decision = acceptFix(state.lastFix, fix);

  if (!decision.accept) {
    if (decision.reason === "not_finite") return state;
    const key = rejectedKey[decision.reason];
    return {
      ...state,
      rejected: { ...state.rejected, [key]: state.rejected[key] + 1 },
      lastAccuracyM: fix.accuracy,
    };
  }

  const point = toRoutePoint(fix, state.startedAtMs);
  const gps: GpsState = fix.accuracy <= GOOD_ACCURACY_M ? "ok" : "weak";

  if (decision.gap) {
    return {
      ...state,
      segments: [...state.segments, [point]],
      gaps: state.gaps + 1,
      gapMs: state.gapMs + decision.dtMs,
      acceptedFixes: state.acceptedFixes + 1,
      lastFix: fix,
      lastAccuracyM: fix.accuracy,
      gps,
      speedMps: null,
    };
  }

  const current = state.segments[state.segments.length - 1] ?? [];
  let last = [...current, point];
  if (last.length > GPS_THRESHOLDS.liveBufferPoints) last = simplifyRoute(last);

  const measured =
    fix.speed ?? (decision.dtMs > 0 ? decision.stepMeters / (decision.dtMs / 1000) : null);

  return {
    ...state,
    segments: withLastSegment(state.segments, last),
    distanceMeters: state.distanceMeters + decision.stepMeters,
    acceptedFixes: state.acceptedFixes + 1,
    lastFix: fix,
    lastAccuracyM: fix.accuracy,
    gps,
    speedMps: smoothSpeed(state.speedMps, measured),
  };
};

const openPauseMs = (state: TrackingState, nowMs: number): number =>
  state.pauseStartedAtMs === null ? 0 : Math.max(0, nowMs - state.pauseStartedAtMs);

export const pauseTracking = (state: TrackingState, nowMs: number): TrackingState => {
  if (state.status === "paused") return state;
  return {
    ...state,
    status: "paused",
    pauses: state.pauses + 1,
    pauseStartedAtMs: nowMs,
    speedMps: null,
  };
};

/** Closes the pause and opens a new segment so the route does not bridge the stop. */
export const resumeTracking = (state: TrackingState, nowMs: number): TrackingState => {
  if (state.status !== "paused") return state;
  return {
    ...state,
    status: "tracking",
    pausedMs: state.pausedMs + openPauseMs(state, nowMs),
    pauseStartedAtMs: null,
    segments: [...state.segments, []],
    lastFix: null,
  };
};

/** The end screen is open: fixes are ignored until the user confirms or goes back. */
export const freezeTracking = (state: TrackingState): TrackingState =>
  state.status === "ending" ? state : { ...state, status: "ending" };

/** Back from the end screen: recording resumes. */
export const unfreezeTracking = (state: TrackingState): TrackingState =>
  state.status === "ending" ? { ...state, status: "tracking" } : state;

export const setGpsStatus = (state: TrackingState, gps: GpsState): TrackingState =>
  state.gps === gps ? state : { ...state, gps };

/** Seconds of the trip, pauses excluded. Never negative. */
export const elapsedSeconds = (state: TrackingState, nowMs: number): number => {
  const active = nowMs - state.startedAtMs - state.pausedMs - openPauseMs(state, nowMs);
  return Math.max(0, Math.floor(active / 1000));
};

/** Seconds spent paused, including the pause in progress. */
export const pausedSeconds = (state: TrackingState, nowMs: number): number =>
  Math.max(0, Math.floor((state.pausedMs + openPauseMs(state, nowMs)) / 1000));

export interface TripEndSummary {
  endedAt: string;
  recordedAt: string;
  /** GPS distance in the vehicle unit, one decimal; null without a measurable route. */
  gpsDistance: number | null;
  /** Odometer suggestion (domain rule 6: the user confirms it). */
  suggestedValue: number | null;
  segments: RoutePoint[][];
  pointCount: number;
  pauses: number;
  pausedSeconds: number;
  gapSeconds: number;
  distanceMeters: number;
}

const totalPoints = (segments: readonly (readonly RoutePoint[])[]): number =>
  segments.reduce((n, segment) => n + segment.length, 0);

/**
 * Brings the whole route under `max` points, shrinking every segment in
 * proportion to its size (never below 2 points, the minimum of a segment).
 */
const capSegments = (segments: RoutePoint[][], max: number): RoutePoint[][] => {
  const total = totalPoints(segments);
  if (total <= max) return segments;
  const ratio = max / total;
  return segments.map((segment) =>
    capRoutePoints(segment, Math.max(2, Math.floor(segment.length * ratio))),
  );
};

/** Closes the trip: the stored route, the measured distance and the odometer suggestion. */
export const finishTracking = (state: TrackingState, nowMs: number): TripEndSummary => {
  const endedAtMs = Math.max(nowMs, state.startedAtMs + 1000);
  const endedAt = new Date(endedAtMs).toISOString();
  const simplified = state.segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => capRoutePoints(simplifyRoute(segment), GPS_THRESHOLDS.maxRoutePoints));
  const segments = capSegments(simplified, GPS_THRESHOLDS.maxRoutePoints);
  const measurable = state.acceptedFixes >= 2;
  return {
    endedAt,
    recordedAt: endedAt,
    gpsDistance: measurable ? roundToTenth(metersToUnit(state.distanceMeters, state.unit)) : null,
    suggestedValue: suggestedEndReading(
      state.startValue,
      measurable ? state.distanceMeters : null,
      state.unit,
    ),
    segments,
    pointCount: totalPoints(segments),
    pauses: state.pauses,
    pausedSeconds: pausedSeconds(state, nowMs),
    gapSeconds: Math.floor(state.gapMs / 1000),
    distanceMeters: state.distanceMeters,
  };
};

const gpsFixSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  t: z.number().finite(),
  accuracy: z.number().min(0),
  speed: z.number().nullable(),
});

const distanceUnitSchema = z.enum(["km", "mi"]);

/** Shape of a persisted snapshot. Live segments may be empty or hold a single point. */
export const trackingStateSchema: z.ZodType<TrackingState> = z.object({
  tripId: z.string().min(1),
  vehicleId: z.string().min(1),
  unit: distanceUnitSchema,
  startReadingId: z.string().min(1),
  startValue: z.number().min(0),
  startedAt: z.string().min(1),
  startedAtMs: z.number().finite(),
  status: z.enum(["tracking", "paused", "ending"]),
  segments: z.array(z.array(routePointSchema)),
  lastFix: gpsFixSchema.nullable(),
  distanceMeters: z.number().min(0),
  acceptedFixes: z.number().int().min(0),
  rejected: z.object({
    inaccurate: z.number().int().min(0),
    tooFast: z.number().int().min(0),
    stale: z.number().int().min(0),
    tooClose: z.number().int().min(0),
  }),
  gapMs: z.number().min(0),
  gaps: z.number().int().min(0),
  pauses: z.number().int().min(0),
  pausedMs: z.number().min(0),
  pauseStartedAtMs: z.number().finite().nullable(),
  gps: z.enum(["searching", "ok", "weak", "timeout", "denied", "unavailable"]),
  lastAccuracyM: z.number().min(0).nullable(),
  speedMps: z.number().nullable(),
});
