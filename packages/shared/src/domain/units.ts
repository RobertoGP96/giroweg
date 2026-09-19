export const UNITS = ["km", "mi", "h"] as const;
export type Unit = (typeof UNITS)[number];

const KM_PER_MILE = 1.609344;

/**
 * Converts a distance between km and mi. Only for display in reports:
 * stored values are never converted (domain rule 3). Hours are not a
 * distance and cannot be converted.
 */
export const convertDistance = (value: number, from: Unit, to: Unit): number => {
  if (from === to) return value;
  if (from === "h" || to === "h") {
    throw new Error("Hours cannot be converted to a distance unit");
  }
  return from === "km" ? value / KM_PER_MILE : value * KM_PER_MILE;
};

/**
 * Whether the unit of a vehicle may still change. It becomes immutable
 * once the vehicle has at least one reading (domain rule 3).
 */
export const canChangeUnit = (readingCount: number): boolean => readingCount === 0;
