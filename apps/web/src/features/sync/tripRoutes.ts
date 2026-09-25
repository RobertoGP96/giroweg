"use client";

import { type TripRoute, tripRouteSchema } from "@giroweg/shared/schemas";
import { z } from "zod";
import { getStore } from "@/db/client";
import { apiFetch } from "./api";

/** Synced routes kept locally beyond the ones still in the outbox. */
export const ROUTE_CACHE_KEEP = 10;

const responseSchema = z.object({ route: tripRouteSchema });

/**
 * Fetches one trip's route on demand (routes are never bulk-pulled), caches
 * it in the local store and trims the cache. Returns null when the server
 * has no route for that trip.
 */
export const pullTripRoute = async (tripId: string): Promise<TripRoute | null> => {
  const response = await apiFetch(`/api/trips/${tripId}/route`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`route_pull_failed_${response.status}`);
  const { route } = responseSchema.parse(await response.json());
  const store = getStore();
  store.applyRemote({ tripRoutes: [route] }, { replace: false });
  store.evictRoutes(ROUTE_CACHE_KEEP);
  return route;
};
