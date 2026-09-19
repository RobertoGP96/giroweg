import type { TripSummary } from "./repository";

const escape = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV for one trip: header + one row. Values are raw (no locale formatting). */
export const tripToCsv = (summary: TripSummary, unit: string): string => {
  const { trip, start, end, distance, durationMinutes, gps } = summary;
  const header = [
    "trip_id",
    "started_at",
    "ended_at",
    "start_reading",
    "end_reading",
    `distance_${unit}`,
    `gps_distance_${unit}`,
    "gps_difference_ratio",
    "duration_minutes",
    "stops",
    "pauses",
    "reason",
  ];
  const row = [
    trip.id,
    trip.startedAt,
    trip.endedAt,
    start.value,
    end?.value ?? null,
    distance,
    trip.gpsDistance,
    gps ? Number(gps.ratio.toFixed(4)) : null,
    durationMinutes,
    trip.stops,
    trip.pauses,
    trip.reason,
  ];
  return `${header.join(",")}\n${row.map(escape).join(",")}\n`;
};

/** Triggers a CSV download in the browser. */
export const exportTripCsv = (summary: TripSummary, unit: string): void => {
  const blob = new Blob([tripToCsv(summary, unit)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `giroweg-trip-${summary.trip.startedAt.slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};
