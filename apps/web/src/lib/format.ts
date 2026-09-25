/**
 * Number and time formatting for the interface. Figures use the Spanish
 * convention of the design: comma as decimal separator and dot as thousands
 * separator, also for four-digit numbers (1.842).
 */
const NUMBER_LOCALE = "es-ES";

export const formatNumber = (value: number, decimals = 1): string =>
  new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: "always",
  }).format(value);

/** Odometer readings: 34.218, or 1.234,5 when the value carries a decimal (hours). */
export const formatOdometer = (value: number): string =>
  formatNumber(value, Number.isInteger(value) ? 0 : 1);

export const formatDistance = (value: number, unit: string, decimals = 1): string =>
  `${formatNumber(value, decimals)} ${unit}`;

/** Odometer distance with the unit, decimals only when present. */
export const formatOdometerDistance = (value: number, unit: string): string =>
  `${formatOdometer(value)} ${unit}`;

/** A 0..1 ratio as a percentage with one decimal: "3,1 %". */
export const formatPercent = (ratio: number): string => `${formatNumber(ratio * 100, 1)} %`;

/** Speed figure without decimals; the unit label goes next to it. */
export const formatSpeed = (value: number): string => formatNumber(value, 0);

/** Elapsed seconds as m:ss or h:mm:ss */
export const formatElapsed = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
};

export const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

/** "viernes 19" */
export const formatDayLabel = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, { weekday: "long", day: "numeric" }).format(
    new Date(iso),
  );

/** "19 sept" */
export const formatShortDate = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, { day: "numeric", month: "short" }).format(
    new Date(iso),
  );

/** "19 sept 2026, 08:15" */
export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

/** Single-letter weekday: L M X J V S D */
export const formatWeekdayLetter = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, { weekday: "narrow" }).format(new Date(iso)).toUpperCase();

export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Value for an <input type="datetime-local"> in the device's local time. */
export const toDateTimeLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Local datetime-local value → UTC ISO 8601 (domain rule 5), or null when invalid. */
export const fromDateTimeLocal = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Plain digits (one decimal at most) for editable numeric fields. */
export const formatInputNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Current instant as a datetime-local value (default for new readings). */
export const nowLocalDateTime = (): string => toDateTimeLocal(new Date().toISOString());
