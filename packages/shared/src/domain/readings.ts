/**
 * Pure rules for odometer readings. A reading may never go below the last
 * valid reading before it in time, nor above the next one (domain rule 2).
 * Readings are append-only; corrections are voids plus new readings.
 */

export interface ReadingLike {
  id: string;
  value: number;
  /** ISO 8601, UTC. */
  recordedAt: string;
  voidedAt?: string | null;
  /**
   * Explicit odometer change (replaced dial, new vehicle counter). It
   * restarts the sequence: it may be below the previous reading and later
   * readings compare against it. Requires user confirmation and a note.
   */
  odometerReset?: boolean;
}

export type ReadingValidation =
  | { ok: true }
  | { ok: false; reason: "below_previous"; previous: ReadingLike }
  | { ok: false; reason: "above_next"; next: ReadingLike }
  | { ok: false; reason: "not_finite" }
  | { ok: false; reason: "negative" };

export interface NewReadingInput {
  value: number;
  recordedAt: string;
  odometerReset?: boolean;
}

const isVoided = (r: ReadingLike): boolean => Boolean(r.voidedAt);

/** Valid readings sorted by recordedAt ascending. */
export const validReadings = <T extends ReadingLike>(readings: T[]): T[] =>
  readings
    .filter((r) => !isVoided(r))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

/** Last valid reading strictly before `at`. */
export const previousReading = (
  readings: ReadingLike[],
  at: string,
): ReadingLike | undefined => {
  const before = validReadings(readings).filter((r) => r.recordedAt < at);
  return before[before.length - 1];
};

/** First valid reading strictly after `at`. */
export const nextReading = (
  readings: ReadingLike[],
  at: string,
): ReadingLike | undefined =>
  validReadings(readings).find((r) => r.recordedAt > at);

export const validateReading = (
  input: NewReadingInput,
  existing: ReadingLike[],
): ReadingValidation => {
  if (!Number.isFinite(input.value)) return { ok: false, reason: "not_finite" };
  if (input.value < 0) return { ok: false, reason: "negative" };

  // An odometer change restarts the sequence: no lower bound for it.
  const previous = previousReading(existing, input.recordedAt);
  if (!input.odometerReset && previous && input.value < previous.value) {
    return { ok: false, reason: "below_previous", previous };
  }
  // A later odometer change starts a new sequence: no upper bound against it.
  const next = nextReading(existing, input.recordedAt);
  if (next && !next.odometerReset && input.value > next.value) {
    return { ok: false, reason: "above_next", next };
  }
  return { ok: true };
};

/**
 * Current odometer of a vehicle: the latest valid reading, or the initial
 * value when there are none (domain rule 4). Never a stored field.
 */
export const currentOdometer = (
  readings: ReadingLike[],
  initialValue: number,
): number => {
  const valid = validReadings(readings);
  const last = valid[valid.length - 1];
  return last ? last.value : initialValue;
};

/** Odometer in force at `at`: the last valid reading on or before it, else the initial value. */
export const odometerAt = (
  readings: ReadingLike[],
  at: string,
  initialValue: number,
): number => {
  const before = validReadings(readings).filter((r) => r.recordedAt <= at);
  const last = before[before.length - 1];
  return last ? last.value : initialValue;
};

/**
 * Distance travelled between two instants, derived from the readings only.
 * Sums the increments between consecutive valid readings inside the window,
 * taking the last reading on or before `from` as the baseline. An odometer
 * change contributes nothing (the counter restarted), so the result is never
 * negative. Without a baseline, the first reading in the window starts it.
 */
export const distanceTravelled = (
  readings: ReadingLike[],
  from: string,
  to: string,
): number => {
  const valid = validReadings(readings);
  let baseline = -1;
  for (let i = 0; i < valid.length; i += 1) {
    const reading = valid[i];
    if (reading && reading.recordedAt <= from) baseline = i;
  }
  let total = 0;
  for (let i = Math.max(baseline, 0) + 1; i < valid.length; i += 1) {
    const previous = valid[i - 1];
    const current = valid[i];
    if (!previous || !current || current.recordedAt > to) break;
    if (!current.odometerReset) total += Math.max(current.value - previous.value, 0);
  }
  return total;
};

/**
 * Increment of each valid reading over the previous valid one, keyed by id.
 * The first reading and an odometer change have no increment (null); voided
 * readings are not included.
 */
export const readingDeltas = (readings: ReadingLike[]): Map<string, number | null> => {
  const deltas = new Map<string, number | null>();
  const valid = validReadings(readings);
  valid.forEach((reading, index) => {
    const previous = index > 0 ? valid[index - 1] : undefined;
    deltas.set(
      reading.id,
      previous && !reading.odometerReset ? reading.value - previous.value : null,
    );
  });
  return deltas;
};

/** Readings are never edited: voiding requires a reason. */
export const canVoid = (reading: ReadingLike, reason: string): boolean =>
  !isVoided(reading) && reason.trim().length > 0;
