/**
 * Mirrors the local store to localStorage so data and the outbox survive a
 * reload or an offline restart. Same contract IndexedDB/SQLite will honour:
 * load once at start-up, save after every change. Corrupt or foreign data
 * is discarded rather than trusted.
 */
import { readingSchema, vehicleSchema } from "@giroweg/shared/schemas";
import { z } from "zod";
import { emptyState, type StoreState } from "./store";

const STORAGE_KEY = "giroweg.local.v1";
const SAVE_DELAY_MS = 150;

const outboxEntrySchema = z.object({
  id: z.string(),
  table: z.enum(["vehicles", "readings"]),
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
  outbox: z.array(outboxEntrySchema),
  session: z.object({ userId: z.string(), orgId: z.string() }).nullable(),
  prefs: z.object({ selectedVehicleId: z.string().nullable() }),
  pulledAt: z.string().nullable(),
});

export const loadPersistedState = (): StoreState => {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyState();
  } catch {
    return emptyState();
  }
};

/** Debounced writer: several changes in a row cost one serialization. */
export const createPersister = (): ((state: StoreState) => void) => {
  let timer: number | undefined;
  return (state) => {
    if (typeof window === "undefined") return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Quota exceeded or private mode: the in-memory store keeps working.
      }
    }, SAVE_DELAY_MS);
  };
};

export const clearPersistedState = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
};
