import type { Reading, Trip, TripRoute, Vehicle } from "@giroweg/shared/schemas";
import { describe, expect, it, vi } from "vitest";
import { emptyState, LocalStore } from "@/db/store";
import { isDue, planPush, settleResults } from "./engine";
import { DEPENDENCY_REJECTED, MAX_ROUTES_PER_PUSH, type PushResult } from "./protocol";

vi.mock("./api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/auth/client", () => ({ authClient: {} }));
vi.mock("@/features/trips/snapshot", () => ({ clearTripSnapshot: vi.fn() }));

const ORG = "018f6d2a-0000-7000-8000-000000000001";
const V1 = "018f6d2a-0000-7000-8000-00000000a001";
const R1 = "018f6d2a-0000-7000-8000-00000000b001";
const R2 = "018f6d2a-0000-7000-8000-00000000b002";
const T1 = "018f6d2a-0000-7000-8000-00000000c001";
const T2 = "018f6d2a-0000-7000-8000-00000000c002";
const RT1 = "018f6d2a-0000-7000-8000-00000000d001";
const at = (hour: number): string => `2026-09-19T${String(hour).padStart(2, "0")}:00:00.000Z`;
const routeId = (n: number): string => `018f6d2a-0000-7000-8000-00000000d${String(n).padStart(3, "0")}`;
const tripId = (n: number): string => `018f6d2a-0000-7000-8000-00000000c${String(n).padStart(3, "0")}`;

const vehicle = (id: string): Vehicle => ({
  id,
  orgId: ORG,
  createdAt: at(10),
  updatedAt: at(10),
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
});

const reading = (id: string, value: number): Reading => ({
  id,
  orgId: ORG,
  createdAt: at(10),
  updatedAt: at(10),
  syncedAt: null,
  vehicleId: V1,
  value,
  recordedAt: at(10),
  source: "manual",
  photoPath: null,
  note: null,
  createdBy: "user",
  voidedAt: null,
  voidReason: null,
  odometerReset: false,
});

const trip = (id: string, endReadingId: string | null = null): Trip => ({
  id,
  orgId: ORG,
  createdAt: at(9),
  updatedAt: at(9),
  syncedAt: null,
  vehicleId: V1,
  startReadingId: R1,
  endReadingId,
  startedAt: at(9),
  endedAt: endReadingId ? at(10) : null,
  gpsDistance: null,
  reason: null,
  stops: 0,
  pauses: 0,
  pausedSeconds: 0,
});

const route = (id: string, forTrip: string): TripRoute => ({
  id,
  orgId: ORG,
  createdAt: at(9),
  updatedAt: at(9),
  syncedAt: null,
  tripId: forTrip,
  segments: [
    [
      [-3.7, 40.4, 0, 5],
      [-3.71, 40.41, 1000, 5],
    ],
  ],
  pointCount: 2,
});

const ok = (table: PushResult["table"], id: string): PushResult => ({
  table,
  id,
  ok: true,
  syncedAt: at(12),
  error: null,
  permanent: false,
});

const fail = (table: PushResult["table"], id: string, error: string, permanent = true): PushResult => ({
  table,
  id,
  ok: false,
  syncedAt: null,
  error,
  permanent,
});

const entriesOf = (store: LocalStore, table: PushResult["table"], recordId: string) =>
  store.outbox.filter((entry) => entry.table === table && entry.recordId === recordId);

describe("planPush", () => {
  it("sends the latest row of each due record, parents first, and skips entries in backoff", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R1, 100));
    store.write("vehicles", vehicle(V1));
    store.write("trips", trip(T1));
    store.write("trips", trip(T1, R2));
    store.write("readings", reading(R2, 120));
    const [r2Entry] = entriesOf(store, "readings", R2);
    if (!r2Entry) throw new Error("expected an entry for R2");
    store.failOutbox([r2Entry.id], "network", () => at(23));

    const { payload, sent } = planPush(store, new Date(at(12)).getTime());

    expect(payload.vehicles.map((v) => v.id)).toEqual([V1]);
    expect(payload.readings.map((r) => r.id)).toEqual([R1]);
    expect(payload.trips).toHaveLength(1);
    expect(payload.trips[0]?.endReadingId).toBe(R2);
    expect(payload.tripRoutes).toEqual([]);
    expect(sent.map((entry) => entry.table)).toEqual(["vehicles", "readings", "trips", "trips"]);
    expect(sent.some((entry) => entry.id === r2Entry.id)).toBe(false);
  });

  it("sends at most MAX_ROUTES_PER_PUSH routes and leaves the rest due", () => {
    const store = new LocalStore(emptyState());
    const total = MAX_ROUTES_PER_PUSH + 2;
    for (let n = 1; n <= total; n += 1) {
      store.write("trips", trip(tripId(n)));
      store.write("tripRoutes", route(routeId(n), tripId(n)));
    }

    const { payload, sent } = planPush(store);

    expect(payload.tripRoutes.map((r) => r.id)).toEqual(
      Array.from({ length: MAX_ROUTES_PER_PUSH }, (_, i) => routeId(i + 1)),
    );
    expect(payload.trips).toHaveLength(total);
    const heldBack = store.outbox.filter(
      (entry) => entry.table === "tripRoutes" && !sent.some((s) => s.id === entry.id),
    );
    expect(heldBack).toHaveLength(total - MAX_ROUTES_PER_PUSH);
    expect(heldBack.every((entry) => isDue(entry) && entry.attempts === 0)).toBe(true);
  });
});

describe("settleResults", () => {
  it("acks every entry of an accepted record and stamps the sync time", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1));
    store.write("trips", trip(T1, R2));
    store.write("readings", reading(R2, 120));
    const { sent } = planPush(store);

    settleResults(store, sent, [ok("readings", R2), ok("trips", T1)]);

    expect(store.outbox).toHaveLength(0);
    expect(store.table("trips")[0]?.syncedAt).toBe(at(12));
    expect(store.table("readings")[0]?.syncedAt).toBe(at(12));
  });

  it("holds a trip whose end reading was rejected as dependency_rejected with a permanent backoff", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R2, 50));
    store.write("trips", trip(T1, R2));
    const { sent } = planPush(store);
    const before = Date.now();

    settleResults(store, sent, [
      fail("readings", R2, "reading_below_previous"),
      fail("trips", T1, "check_violation"),
    ]);

    const [tripEntry] = entriesOf(store, "trips", T1);
    expect(tripEntry?.lastError).toBe(DEPENDENCY_REJECTED);
    expect(tripEntry?.attempts).toBe(1);
    expect(new Date(tripEntry?.nextAttemptAt ?? 0).getTime()).toBeGreaterThanOrEqual(before + 29 * 60_000);
    const [readingEntry] = entriesOf(store, "readings", R2);
    expect(readingEntry?.lastError).toBe("reading_below_previous");
  });

  it("holds a route whose trip failed as dependency_rejected", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1));
    store.write("tripRoutes", route(RT1, T1));
    const { sent } = planPush(store);

    settleResults(store, sent, [fail("trips", T1, "trip_start_immutable"), fail("tripRoutes", RT1, "unique_violation")]);

    expect(entriesOf(store, "tripRoutes", RT1)[0]?.lastError).toBe(DEPENDENCY_REJECTED);
    expect(entriesOf(store, "trips", T1)[0]?.lastError).toBe("trip_start_immutable");
  });

  it("reclassifies a foreign key violation on a trip as dependency_rejected", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T2));
    const { sent } = planPush(store);

    settleResults(store, sent, [fail("trips", T2, "foreign_key_violation")]);

    expect(entriesOf(store, "trips", T2)[0]?.lastError).toBe(DEPENDENCY_REJECTED);
  });

  it("keeps other server errors as they are", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R1, 100));
    const { sent } = planPush(store);

    settleResults(store, sent, [fail("readings", R1, "foreign_key_violation")]);

    expect(entriesOf(store, "readings", R1)[0]?.lastError).toBe("foreign_key_violation");
  });

  it("clears the dependency backoff once a reading is accepted", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1));
    const [tripEntry] = entriesOf(store, "trips", T1);
    if (!tripEntry) throw new Error("expected a trip entry");
    store.failOutbox([tripEntry.id], DEPENDENCY_REJECTED, () => at(23));
    store.write("readings", reading(R1, 100));
    const { sent } = planPush(store, new Date(at(12)).getTime());
    expect(sent.map((entry) => entry.table)).toEqual(["readings"]);

    settleResults(store, sent, [ok("readings", R1)]);

    expect(entriesOf(store, "trips", T1)[0]?.nextAttemptAt).toBeNull();
    expect(entriesOf(store, "readings", R1)).toHaveLength(0);
  });
});
