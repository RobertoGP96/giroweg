/**
 * Development-only position source: a loop around a fixed point with the
 * imperfections of a real signal (lateral jitter, one long silence and one
 * burst of inaccurate fixes) so the tracker can be exercised on a desk.
 * Enabled with `?sim=1` in development builds only.
 */

import type { GpsFix } from "@giroweg/shared/domain";
import { EARTH_RADIUS_M } from "@giroweg/shared/domain";

const CENTER = { lng: -3.7038, lat: 40.4168 };
const RADIUS_M = 400;
/** Fast enough for consecutive one-second fixes to clear the 10 m step filter. */
const SPEED_KMH = 40;
const JITTER_M = 3;
const ACCURACY_M = 6;
const GAP_AFTER_FIXES = 40;
const GAP_MS = 180_000;
const INACCURATE_FROM = 60;
const INACCURATE_COUNT = 3;
const INACCURATE_ACCURACY_M = 80;

const DEG_TO_RAD = Math.PI / 180;
const M_PER_DEG_LAT = EARTH_RADIUS_M * DEG_TO_RAD;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(CENTER.lat * DEG_TO_RAD);

/** Deterministic pseudo-random in [-1, 1) so the route replays identically. */
const noise = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export interface GpsSimulatorOptions {
  intervalMs?: number;
  now?: () => number;
}

/** Simulated clock offset (ms) accumulated by the injected gaps up to fix `index`. */
const gapOffsetMs = (index: number): number => (index >= GAP_AFTER_FIXES ? GAP_MS : 0);

/**
 * The fix emitted at `index` (0-based) when the trip started at `startMs`.
 * Time runs at `intervalMs` per fix plus the gap; the position follows the
 * elapsed simulated time so the loop stays continuous across the silence.
 */
export const simulatedFix = (index: number, startMs: number, intervalMs: number): GpsFix => {
  const elapsedMs = index * intervalMs + gapOffsetMs(index);
  const distanceM = (SPEED_KMH / 3.6) * (elapsedMs / 1000);
  const angle = distanceM / RADIUS_M;
  const lateral = noise(index) * JITTER_M;
  const radius = RADIUS_M + lateral;
  const inaccurate = index >= INACCURATE_FROM && index < INACCURATE_FROM + INACCURATE_COUNT;
  return {
    lng: CENTER.lng + (radius * Math.cos(angle)) / M_PER_DEG_LNG,
    lat: CENTER.lat + (radius * Math.sin(angle)) / M_PER_DEG_LAT,
    t: startMs + elapsedMs,
    accuracy: inaccurate ? INACCURATE_ACCURACY_M : ACCURACY_M,
    speed: SPEED_KMH / 3.6,
  };
};

/** Indices whose fixes are meant to be rejected or to open a new segment. */
export const SIMULATOR_EVENTS = {
  gapAtIndex: GAP_AFTER_FIXES,
  inaccurateFrom: INACCURATE_FROM,
  inaccurateCount: INACCURATE_COUNT,
} as const;

/** Emits one fix per interval; returns the function that stops it. */
export const startGpsSimulator = (
  onFix: (fix: GpsFix) => void,
  options: GpsSimulatorOptions = {},
): (() => void) => {
  const intervalMs = options.intervalMs ?? 1000;
  const now = options.now ?? (() => Date.now());
  const startMs = now();
  let index = 0;
  const timer = setInterval(() => {
    onFix(simulatedFix(index, startMs, intervalMs));
    index += 1;
  }, intervalMs);
  return () => clearInterval(timer);
};

/** `?sim=1` in a development build swaps the geolocation watch for the simulator. */
export const isGpsSimulationEnabled = (): boolean =>
  process.env.NODE_ENV === "development" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sim") === "1";
