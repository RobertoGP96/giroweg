import { GPS_ODOMETER_TOLERANCE } from "../tokens";

/** Distance of a trip from its start and end readings. */
export const tripDistance = (startValue: number, endValue: number): number =>
  Math.max(endValue - startValue, 0);

export interface GpsComparison {
  /** Absolute difference between odometer and GPS distance. */
  difference: number;
  /** Difference relative to the odometer distance, 0..1. */
  ratio: number;
  /** Inside the accepted tolerance. */
  withinMargin: boolean;
}

/**
 * Compares the odometer distance with the GPS distance of the same trip.
 * Within ±3 % is normal; beyond that the trip is flagged for review.
 */
export const compareGpsWithOdometer = (
  odometerDistance: number,
  gpsDistance: number,
  tolerance: number = GPS_ODOMETER_TOLERANCE,
): GpsComparison => {
  const difference = Math.abs(odometerDistance - gpsDistance);
  // Without an odometer distance the ratio is undefined: no movement on
  // either side is a match (0); any GPS distance is a total mismatch (1).
  const ratio =
    odometerDistance === 0 ? (gpsDistance === 0 ? 0 : 1) : difference / odometerDistance;
  return { difference, ratio, withinMargin: ratio <= tolerance };
};

/** Distance per litre. Returns null when litres are not positive. */
export const fuelEfficiency = (distance: number, litres: number): number | null =>
  litres > 0 ? distance / litres : null;

/** Cost per unit of distance. Returns null when distance is not positive. */
export const costPerDistance = (amount: number, distance: number): number | null =>
  distance > 0 ? amount / distance : null;

export interface MaintenanceProgress {
  /** Units remaining until the next service. Negative when overdue. */
  remaining: number;
  /** Progress of the interval, 0..1 (clamped). */
  progress: number;
  /** Progress above 90 % is shown in amber. */
  urgent: boolean;
}

export const maintenanceProgress = (
  current: number,
  lastDone: number,
  interval: number,
): MaintenanceProgress => {
  const next = lastDone + interval;
  const remaining = next - current;
  const raw = interval > 0 ? (current - lastDone) / interval : 1;
  const progress = Math.min(Math.max(raw, 0), 1);
  return { remaining, progress, urgent: progress > 0.9 };
};
