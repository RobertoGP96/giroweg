import type { Reading, Trip, TripRoute, Vehicle } from "@giroweg/shared/schemas";
import type { TableName } from "@/db/store";

/**
 * Wire contract between the device and `/api/sync` (push and pull) and
 * `/api/trips/[tripId]/route` (one route on demand). Shared by the engine
 * and the route handlers so both sides agree on the shape; only types and
 * constants live here.
 */

/** Body of `POST /api/sync`: the latest local state of every due record. */
export interface PushPayload {
  vehicles: Vehicle[];
  readings: Reading[];
  trips: Trip[];
  tripRoutes: TripRoute[];
}

/** Verdict of the server on one pushed record. */
export interface PushResult {
  table: TableName;
  id: string;
  ok: boolean;
  syncedAt: string | null;
  error: string | null;
  /** Retrying the same record cannot succeed (validation, integrity). */
  permanent: boolean;
}

/** Body of `GET /api/sync`. Routes are never bulk-pulled: they are fetched per trip. */
export interface PullResponse {
  userId: string;
  organizationId: string;
  serverTime: string;
  vehicles: Vehicle[];
  readings: Reading[];
  trips: Trip[];
}

/** Body of `GET /api/trips/[tripId]/route`. */
export interface TripRouteResponse {
  route: TripRoute;
}

/**
 * Local outbox error for a trip or route whose parent (reading or trip) was
 * rejected in the same batch: it waits until that parent gets through.
 */
export const DEPENDENCY_REJECTED = "dependency_rejected";

/** Routes are the heaviest rows; a push carries at most this many. */
export const MAX_ROUTES_PER_PUSH = 3;
