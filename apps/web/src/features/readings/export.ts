import type { Vehicle } from "@giroweg/shared/schemas";
import type { ReadingEntry } from "./repository";

const escape = (value: string | number | boolean | null): string => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV of a vehicle's readings, oldest first. Values are raw (no locale formatting). */
export const readingsToCsv = (vehicle: Vehicle, entries: ReadingEntry[]): string => {
  const header = [
    "reading_id",
    "vehicle",
    "plate",
    "recorded_at",
    `value_${vehicle.unit}`,
    `delta_${vehicle.unit}`,
    "source",
    "note",
    "odometer_reset",
    "voided_at",
    "void_reason",
    "synced_at",
  ];
  const rows = [...entries]
    .sort((a, b) => a.reading.recordedAt.localeCompare(b.reading.recordedAt))
    .map(({ reading, delta }) =>
      [
        reading.id,
        vehicle.name,
        vehicle.plate,
        reading.recordedAt,
        reading.value,
        delta,
        reading.source,
        reading.note,
        reading.odometerReset,
        reading.voidedAt,
        reading.voidReason,
        reading.syncedAt,
      ]
        .map(escape)
        .join(","),
    );
  return `${header.join(",")}\n${rows.join("\n")}\n`;
};

const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "vehiculo";

/** Triggers a CSV download in the browser. */
export const exportReadingsCsv = (vehicle: Vehicle, entries: ReadingEntry[]): void => {
  const blob = new Blob([readingsToCsv(vehicle, entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `giroweg-${slug(vehicle.name)}-lecturas.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};
