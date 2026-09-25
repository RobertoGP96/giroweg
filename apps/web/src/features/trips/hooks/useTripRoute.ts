"use client";

import type { TripRoute } from "@giroweg/shared/schemas";
import { useAsync } from "@/lib/useAsync";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { pullTripRoute } from "@/features/sync/tripRoutes";
import { tripsRepository } from "../repository";

export type TripRouteResult =
  | { kind: "local" | "remote"; route: TripRoute }
  | { kind: "none" }
  | { kind: "offline" };

const loadRoute = async (tripId: string, online: boolean): Promise<TripRouteResult> => {
  const local = await tripsRepository.getRoute(tripId);
  if (local) return { kind: "local", route: local };
  if (!online) return { kind: "offline" };
  const remote = await pullTripRoute(tripId);
  return remote ? { kind: "remote", route: remote } : { kind: "none" };
};

/**
 * The route of a trip: the local copy when the device still has it, else a
 * fetch from the server (evicted routes). The store version is deliberately
 * not a dependency: the pull writes the route locally and would loop.
 */
export const useTripRoute = (tripId: string) => {
  const online = useOnlineStatus();
  return useAsync(`tripRoute:${tripId}`, () => loadRoute(tripId, online), [tripId, online]);
};
