/**
 * Pure GPS rules for trip recording: fix filtering, route geometry and the
 * odometer suggestion derived from the measured distance. No DOM, no clock:
 * every time comes in as an argument.
 */

import { GPS_THRESHOLDS } from "../tokens";
import { convertDistance, type Unit } from "./units";

export type DistanceUnit = Exclude<Unit, "h">;

export const isDistanceUnit = (unit: Unit): unit is DistanceUnit => unit !== "h";

export interface GeoPoint {
  lng: number;
  lat: number;
}

/** A raw position as reported by the device. */
export interface GpsFix extends GeoPoint {
  /** Epoch milliseconds, device clock. */
  t: number;
  /** 95 % confidence radius in metres. */
  accuracy: number;
  /** Ground speed in m/s when the device reports it. */
  speed: number | null;
}

/** Compact stored point: `[lng, lat, tOffsetMs, accuracyM]`. */
export type RoutePoint = readonly [lng: number, lat: number, tOffsetMs: number, accuracyM: number];
export type RouteSegment = RoutePoint[];

export interface GpsThresholds {
  maxAccuracyM: number;
  minStepM: number;
  maxSpeedMps: number;
  maxGapMs: number;
}

const defaultThresholds: GpsThresholds = GPS_THRESHOLDS;

export type FixDecision =
  | { accept: true; stepMeters: number; dtMs: number; gap: boolean }
  | { accept: false; reason: "not_finite" | "inaccurate" | "stale" | "too_close" | "too_fast" };

export const EARTH_RADIUS_M = 6_371_000;

const DEG_TO_RAD = Math.PI / 180;

/** Great-circle distance in metres between two points. */
export const haversineMeters = (a: GeoPoint, b: GeoPoint): number => {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLat = lat2 - lat1;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

const isValidFix = (fix: GpsFix): boolean =>
  Number.isFinite(fix.lng) &&
  Number.isFinite(fix.lat) &&
  Number.isFinite(fix.t) &&
  Number.isFinite(fix.accuracy) &&
  fix.lat >= -90 &&
  fix.lat <= 90 &&
  fix.lng >= -180 &&
  fix.lng <= 180;

/**
 * Decides whether a raw fix joins the route. `previous` is the last ACCEPTED
 * fix, not the last one received (distance-filter semantics): rejected fixes
 * never move the reference, so slow drift still adds up once it exceeds the
 * step threshold. The first fix is accepted with a zero step. The checks run
 * in order: not_finite, inaccurate, stale, too_close, too_fast. An accepted
 * fix after more than `maxGapMs` is flagged with `gap` so the caller can start
 * a new segment instead of drawing a straight line across the silence.
 */
export const acceptFix = (
  previous: GpsFix | null,
  fix: GpsFix,
  thresholds: GpsThresholds = defaultThresholds,
): FixDecision => {
  if (!isValidFix(fix)) return { accept: false, reason: "not_finite" };
  if (fix.accuracy > thresholds.maxAccuracyM) return { accept: false, reason: "inaccurate" };
  if (previous === null) return { accept: true, stepMeters: 0, dtMs: 0, gap: false };
  if (fix.t <= previous.t) return { accept: false, reason: "stale" };

  const stepMeters = haversineMeters(previous, fix);
  const dtMs = fix.t - previous.t;
  const minStep = Math.max(thresholds.minStepM, fix.accuracy, previous.accuracy);
  if (stepMeters < minStep) return { accept: false, reason: "too_close" };
  if (stepMeters / (dtMs / 1000) > thresholds.maxSpeedMps) {
    return { accept: false, reason: "too_fast" };
  }
  return { accept: true, stepMeters, dtMs, gap: dtMs > thresholds.maxGapMs };
};

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Compacts an accepted fix relative to the trip start. */
export const toRoutePoint = (fix: GpsFix, startedAtMs: number): RoutePoint => [
  round6(fix.lng),
  round6(fix.lat),
  Math.max(0, Math.round(fix.t - startedAtMs)),
  Math.round(fix.accuracy),
];

export const routePointToGeo = (p: RoutePoint): GeoPoint => ({ lng: p[0], lat: p[1] });

/** Sum of the consecutive great-circle distances; 0 for fewer than 2 points. */
export const routeDistanceMeters = (points: readonly RoutePoint[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += haversineMeters(routePointToGeo(a), routePointToGeo(b));
  }
  return total;
};

/** Distance of a route made of segments; gaps between segments add nothing. */
export const segmentsDistanceMeters = (
  segments: readonly (readonly RoutePoint[])[],
): number => segments.reduce((total, segment) => total + routeDistanceMeters(segment), 0);

interface Projected {
  x: number;
  y: number;
}

/** Local equirectangular projection in metres around the route's mean latitude. */
const project = (points: readonly RoutePoint[]): Projected[] => {
  const meanLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const kx = Math.cos(meanLat * DEG_TO_RAD) * EARTH_RADIUS_M * DEG_TO_RAD;
  const ky = EARTH_RADIUS_M * DEG_TO_RAD;
  return points.map((p) => ({ x: p[0] * kx, y: p[1] * ky }));
};

/** Squared distance from `p` to the segment `a`-`b`. */
const segmentDistanceSq = (p: Projected, a: Projected, b: Projected): number => {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
};

/**
 * Douglas-Peucker simplification with the tolerance in metres. Iterative so
 * long routes cannot overflow the stack. Endpoints are always kept and every
 * kept tuple is the original one. Tolerance 0 keeps all points.
 */
export const simplifyRoute = (
  points: readonly RoutePoint[],
  toleranceM: number = GPS_THRESHOLDS.simplifyToleranceM,
): RoutePoint[] => {
  if (points.length <= 2 || toleranceM <= 0) return [...points];
  const projected = project(points);
  const toleranceSq = toleranceM * toleranceM;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [first, last] = range;
    const a = projected[first];
    const b = projected[last];
    if (!a || !b) continue;
    let maxSq = toleranceSq;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const p = projected[i];
      if (!p) continue;
      const d = segmentDistanceSq(p, a, b);
      if (d > maxSq) {
        maxSq = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = true;
      if (index - first > 1) stack.push([first, index]);
      if (last - index > 1) stack.push([index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

/** Uniform decimation keeping both endpoints. */
const decimate = (points: readonly RoutePoint[], max: number): RoutePoint[] => {
  if (points.length <= max) return [...points];
  const first = points[0];
  if (max <= 1) return first ? [first] : [];
  const last = points.length - 1;
  const result: RoutePoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const point = points[Math.round((i * last) / (max - 1))];
    if (point) result.push(point);
  }
  return result;
};

/**
 * Simplifies a route until it has at most `max` points, doubling the
 * tolerance on each round (up to 20). If that is not enough, decimates
 * uniformly while keeping the endpoints.
 */
export const capRoutePoints = (
  points: readonly RoutePoint[],
  max: number,
  toleranceM: number = GPS_THRESHOLDS.simplifyToleranceM,
): RoutePoint[] => {
  let result = simplifyRoute(points, toleranceM);
  let tolerance = toleranceM > 0 ? toleranceM : 1;
  for (let round = 0; round < 20 && result.length > max; round += 1) {
    tolerance *= 2;
    result = simplifyRoute(result, tolerance);
  }
  return result.length > max ? decimate(result, max) : result;
};

/** Bounding box of all segments, or null when there are no points. */
export const routeBounds = (
  segments: readonly (readonly RoutePoint[])[],
): { sw: GeoPoint; ne: GeoPoint } | null => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let count = 0;
  for (const segment of segments) {
    for (const [lng, lat] of segment) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      count += 1;
    }
  }
  if (count === 0) return null;
  return { sw: { lng: minLng, lat: minLat }, ne: { lng: maxLng, lat: maxLat } };
};

export const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

/** Metres to the vehicle's distance unit (display and suggestions only). */
export const metersToUnit = (meters: number, unit: DistanceUnit): number =>
  convertDistance(meters / 1000, "km", unit);

/** Decimals a reading value carries: readings are numeric(10,1). */
export const decimalsOf = (value: number): 0 | 1 => (Number.isInteger(value) ? 0 : 1);

/**
 * Suggested end reading from the start reading plus the GPS distance. The
 * sum is floored to the precision of the start value (an integer start gives
 * an integer, a one-decimal start gives one decimal): odometer dials truncate
 * and GPS overestimates on straight roads, so rounding up would overshoot.
 * Never below the start value. Only a suggestion the user confirms in an
 * editable field (domain rule 6).
 */
export const suggestedEndReading = (
  startValue: number,
  gpsMeters: number | null,
  unit: DistanceUnit,
): number | null => {
  if (gpsMeters === null) return null;
  const factor = decimalsOf(startValue) === 0 ? 1 : 10;
  const floored = Math.floor((startValue + metersToUnit(gpsMeters, unit)) * factor) / factor;
  return Math.max(floored, startValue);
};
