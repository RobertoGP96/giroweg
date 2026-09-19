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

/** Odometer readings are shown without decimals: 34.218 */
export const formatOdometer = (value: number): string => formatNumber(Math.round(value), 0);

/** Odometer as the six digits printed on the dial: 034218 */
export const formatOdometerDial = (value: number): string =>
  String(Math.max(0, Math.round(value))).padStart(6, "0");

export const formatDistance = (value: number, unit: string, decimals = 1): string =>
  `${formatNumber(value, decimals)} ${unit}`;

export const formatPercent = (ratio: number, decimals = 1): string =>
  `${formatNumber(ratio * 100, decimals)} %`;

export const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat(NUMBER_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(amount);

/** Elapsed seconds as m:ss or h:mm:ss */
export const formatElapsed = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
};

/** Duration in minutes as "5 h 12 min" */
export const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
};

export const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export const formatDayLabel = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, { weekday: "long", day: "numeric" }).format(
    new Date(iso),
  );

export const formatShortDate = (iso: string): string =>
  new Intl.DateTimeFormat(NUMBER_LOCALE, { day: "numeric", month: "short" }).format(
    new Date(iso),
  );

export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);
