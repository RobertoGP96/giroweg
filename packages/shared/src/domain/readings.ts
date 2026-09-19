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
export const validReadings = (readings: ReadingLike[]): ReadingLike[] =>
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

/** Readings are never edited: voiding requires a reason. */
export const canVoid = (reading: ReadingLike, reason: string): boolean =>
  !isVoided(reading) && reason.trim().length > 0;
