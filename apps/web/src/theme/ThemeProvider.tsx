"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ThemeName } from "@giroweg/shared/tokens";
import { THEME_STORAGE_KEY } from "./theme-script";

export type ThemePreference = ThemeName | "auto";

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually applied. */
  resolved: ThemeName;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const CHANGE_EVENT = "gw-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

const isPreference = (value: string | null): value is ThemePreference =>
  value === "dark" || value === "light" || value === "auto";

// --- persisted preference as an external store -----------------------------

const readPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
};

const subscribePreference = (callback: () => void) => {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

const writePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage may be unavailable (private mode); the event still updates the UI.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

// --- system color scheme as an external store ------------------------------

const subscribeSystem = (callback: () => void) => {
  const media = window.matchMedia(LIGHT_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

const readSystem = (): ThemeName => (window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribePreference, readPreference, () => "dark" as const);
  const system = useSyncExternalStore(subscribeSystem, readSystem, () => "dark" as const);
  const resolved: ThemeName = preference === "auto" ? system : preference;

  // Apply the resolved theme to the document (the init script did it before hydration).
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => writePreference(next), []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
};
