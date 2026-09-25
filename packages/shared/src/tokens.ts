/**
 * GiroWeg design tokens. Single source of truth for colors, typography,
 * spacing and radii on every platform. Web maps them to CSS variables;
 * mobile maps them to NativeWind. Never write literal values in components.
 */

export type ThemeName = "dark" | "light";

export interface ColorTokens {
  /** Screen background. */
  bg: string;
  /** Cards and inputs. */
  surface: string;
  /** Elevated / nested elements inside a card. */
  surface2: string;
  /** Primary text. */
  text: string;
  /** Secondary text. AA contrast on bg. */
  muted: string;
  /** Primary action background. Never used as text on light backgrounds. */
  lime: string;
  /** Lime as text/icon color (darkened on light theme for contrast). */
  limeText: string;
  /** Alerts: "review". */
  amber: string;
  /** Amber as text/icon color. */
  amberText: string;
  /** Destructive actions only. */
  red: string;
  /** Hairline separators. */
  line: string;
  /** Empty progress tracks. */
  track: string;
  /** Map canvas background. */
  map: string;
  /** Map grid lines. */
  mapLine: string;
  /** Text on top of lime or amber, in both themes. */
  ink: string;
  /** Card shadow. */
  shadow: string;
}

export const colors: Record<ThemeName, ColorTokens> = {
  dark: {
    bg: "#0E1116",
    surface: "#171B22",
    surface2: "#212733",
    text: "#F2F4F7",
    muted: "#9AA3B2",
    lime: "#B6F23C",
    limeText: "#B6F23C",
    amber: "#FFB020",
    amberText: "#FFB020",
    red: "#FF6B6B",
    line: "rgba(255,255,255,0.07)",
    track: "#2A313D",
    map: "#11161E",
    mapLine: "rgba(255,255,255,0.05)",
    ink: "#0E1116",
    shadow: "0 8px 24px rgba(0,0,0,0.28)",
  },
  light: {
    bg: "#FFFFFF",
    surface: "#F2F4F7",
    surface2: "#E3E7EE",
    text: "#0E1116",
    muted: "#4A5262",
    lime: "#B6F23C",
    limeText: "#3E7A00",
    amber: "#FFB020",
    amberText: "#8A5300",
    red: "#C62828",
    line: "rgba(0,0,0,0.08)",
    track: "#D5DAE3",
    map: "#EAEDF2",
    mapLine: "rgba(0,0,0,0.06)",
    ink: "#0E1116",
    shadow: "0 6px 20px rgba(14,17,22,0.10)",
  },
};

export const typography = {
  families: {
    /** Figures and titles. Always with tabular numerals. */
    display: "Space Grotesk",
    /** Interface text. */
    body: "Inter",
  },
  sizes: {
    display: 56,
    odometer: 40,
    screenTitle: 28,
    cardTitle: 20,
    buttonLarge: 19,
    button: 17,
    bodyLarge: 16,
    rowTitle: 15,
    body: 14,
    secondary: 13,
    label: 12,
    nav: 11,
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

/** 4 px scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  screen: 20,
  xl: 24,
  page: 36,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 28,
  pill: 999,
} as const;

export const sizes = {
  /** Minimum touch target. */
  touch: 56,
  buttonPrimary: 64,
  input: 60,
  bottomNav: 84,
  icon: 24,
  iconStroke: 2,
  /** Reference mobile viewport of the design. */
  mobileWidth: 390,
} as const;

/** Difference between GPS and odometer distance considered normal. */
export const GPS_ODOMETER_TOLERANCE = 0.03;

/**
 * Thresholds of the GPS trip recorder. They filter raw fixes, bound the
 * stored route and configure the position watch. Shared by web and mobile.
 */
export const GPS_THRESHOLDS = {
  /** Fixes with a 95 % accuracy radius above this (metres) are discarded. */
  maxAccuracyM: 30,
  /** Minimum distance (metres) from the last accepted fix to count a step. */
  minStepM: 10,
  /** Steps implying a speed above this (m/s, 216 km/h) are discarded as jumps. */
  maxSpeedMps: 60,
  /** Time (ms) without an accepted fix after which the route starts a new segment. */
  maxGapMs: 120_000,
  /** Douglas-Peucker tolerance (metres) used to simplify a route before storing it. */
  simplifyToleranceM: 5,
  /** Maximum number of points of a stored route across all its segments. */
  maxRoutePoints: 3000,
  /** Maximum number of raw points kept in memory while recording. */
  liveBufferPoints: 5000,
  /** Maximum age (ms) of a cached position accepted by the position watch. */
  watchMaximumAgeMs: 1000,
  /** Time (ms) the position watch waits for a fix before reporting a timeout. */
  watchTimeoutMs: 15_000,
} as const;

const kebab = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * Builds the CSS custom properties for a theme, prefixed with `--gw-`.
 * Example: `{ "--gw-bg": "#0E1116", "--gw-lime-text": "#B6F23C" }`.
 */
export const toCssVariables = (theme: ThemeName): Record<string, string> => {
  const entries = Object.entries(colors[theme]).map(([key, value]) => [
    `--gw-${kebab(key)}`,
    value,
  ]);
  return Object.fromEntries(entries);
};

/** Serializes a theme's variables as a CSS declaration block body. */
export const toCssDeclarations = (theme: ThemeName): string =>
  Object.entries(toCssVariables(theme))
    .map(([name, value]) => `${name}:${value};`)
    .join("");
