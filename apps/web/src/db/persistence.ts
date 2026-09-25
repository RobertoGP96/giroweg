/**
 * Mirrors the local store to localStorage so data and the outbox survive a
 * reload or an offline restart. Same contract IndexedDB/SQLite will honour:
 * load once at start-up, save after every change. Corrupt or foreign data
 * is discarded rather than trusted.
 *
 * Routes are large, so they live under their own key: a corrupt or evicted
 * routes blob never costs the vehicles, readings, trips or the outbox.
 */
import { readingSchema, tripRouteSchema, tripSchema, vehicleSchema } from "@giroweg/shared/schemas";
import { z } from "zod";
import { emptyState, type StoreState, TABLE_NAMES } from "./store";

/** Everything but `tripRoutes`. The key is not bumped: older blobs still load. */
export const STORAGE_KEY = "giroweg.local.v1";
/** Only `tripRoutes`. */
export const ROUTES_KEY = "giroweg.routes.v1";
/** Snapshot of the trip being recorded, written by the trips feature. */
export const ACTIVE_TRIP_KEY = "giroweg.trip.v1";
const SAVE_DELAY_MS = 150;

const outboxEntrySchema = z.object({
  id: z.string(),
  table: z.enum(TABLE_NAMES),
  recordId: z.string(),
  operation: z.literal("upsert"),
  createdAt: z.string(),
  attempts: z.number().int().min(0),
  lastError: z.string().nullable(),
  nextAttemptAt: z.string().nullable(),
});

const stateSchema = z.object({
  vehicles: z.array(vehicleSchema),
  readings: z.array(readingSchema),
  trips: z.array(tripSchema).default([]),
  outbox: z.array(outboxEntrySchema),
  session: z.object({ userId: z.string(), orgId: z.string() }).nullable(),
  prefs: z.object({ selectedVehicleId: z.string().nullable() }),
  pulledAt: z.string().nullable(),
});

const routesSchema = z.object({ tripRoutes: z.array(tripRouteSchema) });

/**
 * Rebuilds the store state from the two persisted blobs (already JSON-parsed).
 * An invalid main blob yields an empty state; an invalid routes blob yields
 * no routes while the main state survives.
 */
export const parsePersistedState = (main: unknown, routes: unknown): StoreState => {
  const parsedMain = stateSchema.safeParse(main);
  if (!parsedMain.success) return emptyState();
  const parsedRoutes = routesSchema.safeParse(routes);
  return {
    ...parsedMain.data,
    tripRoutes: parsedRoutes.success ? parsedRoutes.data.tripRoutes : [],
  };
};

/** Serializes the state into the two blobs; `tripRoutes` only goes to `routes`. */
export const splitState = (state: StoreState): { main: string; routes: string } => {
  const { tripRoutes, ...main } = state;
  return { main: JSON.stringify(main), routes: JSON.stringify({ tripRoutes }) };
};

const readJson = (key: string): unknown => {
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
};

export const loadPersistedState = (): StoreState => {
  if (typeof window === "undefined") return emptyState();
  let main: unknown;
  try {
    main = readJson(STORAGE_KEY);
  } catch {
    return emptyState();
  }
  let routes: unknown;
  try {
    routes = readJson(ROUTES_KEY);
  } catch {
    routes = undefined;
  }
  return parsePersistedState(main, routes);
};

/**
 * Called after each attempted write: `error` is null when the key was
 * written and the thrown value (quota, private mode) otherwise.
 */
export type PersistReporter = (key: string, error: unknown) => void;

/**
 * Debounced writer: several changes in a row cost one serialization. The
 * main blob is written first; a failure writing the routes never prevents
 * it. Failures are reported through `onError` and then swallowed: the
 * in-memory store keeps working.
 */
export const createPersister = (onError?: PersistReporter): ((state: StoreState) => void) => {
  let timer: number | undefined;
  const save = (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value);
      onError?.(key, null);
    } catch (error) {
      onError?.(key, error);
    }
  };
  return (state) => {
    if (typeof window === "undefined") return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const { main, routes } = splitState(state);
      save(STORAGE_KEY, main);
      save(ROUTES_KEY, routes);
    }, SAVE_DELAY_MS);
  };
};

export const clearPersistedState = (): void => {
  for (const key of [STORAGE_KEY, ROUTES_KEY, ACTIVE_TRIP_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  }
};
