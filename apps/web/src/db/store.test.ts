import type { Reading, Trip, TripRoute, Vehicle } from "@giroweg/shared/schemas";
import { describe, expect, it, vi } from "vitest";
import { recordSyncState } from "@/features/sync/hooks/useRecordSync";
import { emptyState, LocalStore, type StoreState } from "./store";

const ORG = "018f6d2a-0000-7000-8000-000000000001";

const vehicle = (id: string, updatedAt = "2026-09-19T10:00:00.000Z", name = "Moto"): Vehicle => ({
  id,
  orgId: ORG,
  createdAt: "2026-09-19T10:00:00.000Z",
  updatedAt,
  syncedAt: null,
  type: "motorcycle",
  name,
  brand: null,
  model: null,
  year: null,
  plate: null,
  photoPath: null,
  unit: "km",
  initialValue: 0,
  archivedAt: null,
});

const reading = (id: string, vehicleId: string, value: number): Reading => ({
  id,
  orgId: ORG,
  createdAt: "2026-09-19T10:00:00.000Z",
  updatedAt: "2026-09-19T10:00:00.000Z",
  syncedAt: null,
  vehicleId,
  value,
  recordedAt: "2026-09-19T10:00:00.000Z",
  source: "manual",
  photoPath: null,
  note: null,
  createdBy: "user",
  voidedAt: null,
  voidReason: null,
  odometerReset: false,
});

const trip = (id: string, startedAt: string, syncedAt: string | null = null): Trip => ({
  id,
  orgId: ORG,
  createdAt: startedAt,
  updatedAt: startedAt,
  syncedAt,
  vehicleId: V1,
  startReadingId: R1,
  endReadingId: null,
  startedAt,
  endedAt: null,
  gpsDistance: null,
  reason: null,
  stops: 0,
  pauses: 0,
  pausedSeconds: 0,
});

const route = (id: string, tripId: string, createdAt: string, syncedAt: string | null = null): TripRoute => ({
  id,
  orgId: ORG,
  createdAt,
  updatedAt: createdAt,
  syncedAt,
  tripId,
  segments: [
    [
      [-3.7, 40.4, 0, 5],
      [-3.71, 40.41, 1000, 5],
    ],
  ],
  pointCount: 2,
});

const V1 = "018f6d2a-0000-7000-8000-00000000a001";
const V2 = "018f6d2a-0000-7000-8000-00000000a002";
const R1 = "018f6d2a-0000-7000-8000-00000000b001";
const T1 = "018f6d2a-0000-7000-8000-00000000c001";
const T2 = "018f6d2a-0000-7000-8000-00000000c002";
const T3 = "018f6d2a-0000-7000-8000-00000000c003";
const T4 = "018f6d2a-0000-7000-8000-00000000c004";
const T5 = "018f6d2a-0000-7000-8000-00000000c005";
const RT1 = "018f6d2a-0000-7000-8000-00000000d001";
const RT2 = "018f6d2a-0000-7000-8000-00000000d002";
const RT3 = "018f6d2a-0000-7000-8000-00000000d003";
const RT4 = "018f6d2a-0000-7000-8000-00000000d004";
const RT5 = "018f6d2a-0000-7000-8000-00000000d005";
const at = (hour: number): string => `2026-09-19T${String(hour).padStart(2, "0")}:00:00.000Z`;

describe("LocalStore.write", () => {
  it("upserts the record, queues it in the outbox and persists the state", () => {
    const persist = vi.fn<(state: StoreState) => void>();
    const store = new LocalStore(emptyState(), persist);

    store.write("vehicles", vehicle(V1));
    store.write("vehicles", vehicle(V1, "2026-09-19T11:00:00.000Z", "Moto roja"));

    expect(store.table("vehicles")).toHaveLength(1);
    expect(store.table("vehicles")[0]?.name).toBe("Moto roja");
    expect(store.outbox).toHaveLength(2);
    expect(store.outbox.every((entry) => entry.recordId === V1 && entry.table === "vehicles")).toBe(true);
    expect(store.version).toBe(2);
    expect(persist).toHaveBeenCalledTimes(2);
  });
});

describe("LocalStore.applyRemote", () => {
  it("replaces local rows with the server's and drops rows the server no longer has", () => {
    const store = new LocalStore({ ...emptyState(), vehicles: [vehicle(V1), vehicle(V2)] });

    store.applyRemote({ vehicles: [vehicle(V1, "2026-09-19T12:00:00.000Z", "Servidor")] }, { replace: true });

    expect(store.table("vehicles").map((v) => v.id)).toEqual([V1]);
    expect(store.table("vehicles")[0]?.name).toBe("Servidor");
  });

  it("keeps pending local rows: newer edits win and unsynced rows survive a replace", () => {
    const store = new LocalStore(emptyState());
    store.write("vehicles", vehicle(V1, "2026-09-19T13:00:00.000Z", "Editado local"));
    store.write("vehicles", vehicle(V2, "2026-09-19T13:00:00.000Z", "Solo local"));

    store.applyRemote({ vehicles: [vehicle(V1, "2026-09-19T12:00:00.000Z", "Servidor")] }, { replace: true });

    const names = store.table("vehicles").map((v) => v.name);
    expect(names).toContain("Editado local");
    expect(names).toContain("Solo local");
  });

  it("lets a newer server row overwrite a pending local one", () => {
    const store = new LocalStore(emptyState());
    store.write("vehicles", vehicle(V1, "2026-09-19T12:00:00.000Z", "Local viejo"));

    store.applyRemote({ vehicles: [vehicle(V1, "2026-09-19T14:00:00.000Z", "Servidor nuevo")] }, { replace: true });

    expect(store.table("vehicles")[0]?.name).toBe("Servidor nuevo");
  });

  it("keeps a pending open trip when the server has no trips yet", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1, at(9)));

    store.applyRemote({ trips: [] }, { replace: true });

    expect(store.table("trips").map((t) => t.id)).toEqual([T1]);
  });

  it("only touches the tables present in the payload", () => {
    const store = new LocalStore({
      ...emptyState(),
      trips: [trip(T1, at(9), at(10))],
      tripRoutes: [route(RT1, T1, at(9), at(10))],
    });

    store.applyRemote({ vehicles: [vehicle(V1)], readings: [reading(R1, V1, 10)] }, { replace: true });

    expect(store.table("vehicles")).toHaveLength(1);
    expect(store.table("readings")).toHaveLength(1);
    expect(store.table("trips")).toHaveLength(1);
    expect(store.table("tripRoutes")).toHaveLength(1);
  });
});

describe("outbox lifecycle", () => {
  it("acks delivered entries and stamps the server sync time", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R1, V1, 100));
    const [entry] = store.outbox;
    if (!entry) throw new Error("expected an outbox entry");

    store.markSynced("readings", R1, "2026-09-19T15:00:00.000Z");
    store.ackOutbox([entry.id]);

    expect(store.outbox).toHaveLength(0);
    expect(store.table("readings")[0]?.syncedAt).toBe("2026-09-19T15:00:00.000Z");
    expect(recordSyncState(store.outbox, R1)).toBe("synced");
  });

  it("records failures with backoff and clears it on manual retry", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R1, V1, 100));
    const [entry] = store.outbox;
    if (!entry) throw new Error("expected an outbox entry");

    expect(recordSyncState(store.outbox, R1)).toBe("pending");
    store.failOutbox([entry.id], "reading_below_previous", (attempts) => `retry-after-${attempts}`);

    const failed = store.outbox[0];
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toBe("reading_below_previous");
    expect(failed?.nextAttemptAt).toBe("retry-after-1");
    expect(recordSyncState(store.outbox, R1)).toBe("error");

    store.retryOutbox();
    expect(store.outbox[0]?.nextAttemptAt).toBeNull();
  });

  it("stamps the sync time on trips and routes", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1, at(9)));
    store.write("tripRoutes", route(RT1, T1, at(9)));

    store.markSynced("trips", T1, at(10));
    store.markSynced("tripRoutes", RT1, at(11));

    expect(store.table("trips")[0]?.syncedAt).toBe(at(10));
    expect(store.table("tripRoutes")[0]?.syncedAt).toBe(at(11));
  });

  it("acks every entry of a record, including one in backoff", () => {
    const store = new LocalStore(emptyState());
    store.write("trips", trip(T1, at(9)));
    store.write("trips", trip(T1, at(9)));
    store.write("readings", reading(R1, V1, 100));
    const [first] = store.outbox;
    if (!first) throw new Error("expected an outbox entry");
    store.failOutbox([first.id], "network", () => at(12));

    store.ackRecord("trips", T1);

    expect(store.outbox).toHaveLength(1);
    expect(store.outbox[0]?.table).toBe("readings");
  });

  it("retries only the entries whose error matches the filter", () => {
    const store = new LocalStore(emptyState());
    store.write("readings", reading(R1, V1, 100));
    store.write("trips", trip(T1, at(9)));
    const ids = store.outbox.map((entry) => entry.id);
    const [readingEntry, tripEntry] = ids;
    if (!readingEntry || !tripEntry) throw new Error("expected two outbox entries");
    store.failOutbox([readingEntry], "reading_below_previous", () => at(12));
    store.failOutbox([tripEntry], "network", () => at(12));

    store.retryOutbox({ errors: ["network"] });

    expect(store.outbox.find((e) => e.id === readingEntry)?.nextAttemptAt).toBe(at(12));
    expect(store.outbox.find((e) => e.id === tripEntry)?.nextAttemptAt).toBeNull();
  });
});

describe("LocalStore.evictRoutes", () => {
  it("keeps the newest synced routes by trip start plus every pending one", () => {
    const store = new LocalStore({
      ...emptyState(),
      trips: [trip(T1, at(1), at(2)), trip(T2, at(4), at(5)), trip(T3, at(3), at(5)), trip(T4, at(2), at(5))],
      tripRoutes: [
        route(RT1, T1, at(1), at(2)),
        route(RT2, T2, at(4), at(5)),
        route(RT3, T3, at(3), at(5)),
        route(RT4, T4, at(2), at(5)),
      ],
    });
    store.write("tripRoutes", route(RT5, T5, at(0)));

    store.evictRoutes(2);

    expect(store.table("tripRoutes").map((r) => r.id).sort()).toEqual([RT2, RT3, RT5]);
    expect(store.outbox).toHaveLength(1);
  });
});

describe("session and reset", () => {
  it("stores the device session and preferences and wipes everything on reset", () => {
    const store = new LocalStore(emptyState());
    store.setSession({ userId: "user", orgId: ORG });
    store.setPrefs({ selectedVehicleId: V1 });
    store.write("vehicles", vehicle(V1));

    store.reset();

    expect(store.session).toBeNull();
    expect(store.prefs.selectedVehicleId).toBeNull();
    expect(store.table("vehicles")).toHaveLength(0);
    expect(store.outbox).toHaveLength(0);
  });
});
