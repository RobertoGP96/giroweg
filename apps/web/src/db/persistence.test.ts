import type { Reading, TripRoute, Vehicle } from "@giroweg/shared/schemas";
import { describe, expect, it } from "vitest";
import { parsePersistedState, splitState } from "./persistence";
import { emptyState, type OutboxEntry, type StoreState } from "./store";

const ORG = "018f6d2a-0000-7000-8000-000000000001";
const V1 = "018f6d2a-0000-7000-8000-00000000a001";
const R1 = "018f6d2a-0000-7000-8000-00000000b001";
const T1 = "018f6d2a-0000-7000-8000-00000000c001";
const RT1 = "018f6d2a-0000-7000-8000-00000000d001";
const AT = "2026-09-19T10:00:00.000Z";

const vehicle: Vehicle = {
  id: V1,
  orgId: ORG,
  createdAt: AT,
  updatedAt: AT,
  syncedAt: null,
  type: "motorcycle",
  name: "Moto",
  brand: null,
  model: null,
  year: null,
  plate: null,
  photoPath: null,
  unit: "km",
  initialValue: 0,
  archivedAt: null,
};

const reading: Reading = {
  id: R1,
  orgId: ORG,
  createdAt: AT,
  updatedAt: AT,
  syncedAt: null,
  vehicleId: V1,
  value: 100,
  recordedAt: AT,
  source: "manual",
  photoPath: null,
  note: null,
  createdBy: "user",
  voidedAt: null,
  voidReason: null,
  odometerReset: false,
};

const route: TripRoute = {
  id: RT1,
  orgId: ORG,
  createdAt: AT,
  updatedAt: AT,
  syncedAt: null,
  tripId: T1,
  segments: [
    [
      [-3.7, 40.4, 0, 5],
      [-3.71, 40.41, 1000, 5],
    ],
  ],
  pointCount: 2,
};

const entry: OutboxEntry = {
  id: "018f6d2a-0000-7000-8000-00000000e001",
  table: "readings",
  recordId: R1,
  operation: "upsert",
  createdAt: AT,
  attempts: 0,
  lastError: null,
  nextAttemptAt: null,
};

/** A blob written before trips existed: no `trips`, no `tripRoutes`. */
const legacyMain = {
  vehicles: [vehicle],
  readings: [reading],
  outbox: [entry],
  session: { userId: "user", orgId: ORG },
  prefs: { selectedVehicleId: V1 },
  pulledAt: AT,
};

describe("parsePersistedState", () => {
  it("loads a v1 blob without trips and keeps vehicles, readings, outbox and session", () => {
    const state = parsePersistedState(legacyMain, undefined);

    expect(state.vehicles).toEqual([vehicle]);
    expect(state.readings).toEqual([reading]);
    expect(state.outbox).toEqual([entry]);
    expect(state.session).toEqual({ userId: "user", orgId: ORG });
    expect(state.prefs.selectedVehicleId).toBe(V1);
    expect(state.trips).toEqual([]);
    expect(state.tripRoutes).toEqual([]);
  });

  it("falls back to the empty state when the outbox names an unknown table", () => {
    const state = parsePersistedState(
      { ...legacyMain, outbox: [{ ...entry, table: "expenses" }] },
      { tripRoutes: [route] },
    );

    expect(state).toEqual(emptyState());
  });

  it("drops corrupt routes while the main state survives", () => {
    const state = parsePersistedState(legacyMain, { tripRoutes: [{ ...route, pointCount: 3 }] });

    expect(state.vehicles).toEqual([vehicle]);
    expect(state.tripRoutes).toEqual([]);
  });

  it("restores routes from the routes blob", () => {
    const state = parsePersistedState(legacyMain, { tripRoutes: [route] });

    expect(state.tripRoutes).toEqual([route]);
  });
});

describe("splitState", () => {
  it("puts tripRoutes only in the routes blob", () => {
    const state: StoreState = { ...emptyState(), vehicles: [vehicle], tripRoutes: [route] };

    const { main, routes } = splitState(state);
    const parsedMain: unknown = JSON.parse(main);
    const parsedRoutes: unknown = JSON.parse(routes);

    expect(main).not.toContain("tripRoutes");
    expect(parsedRoutes).toEqual({ tripRoutes: [route] });
    expect(parsePersistedState(parsedMain, parsedRoutes)).toEqual(state);
  });
});
