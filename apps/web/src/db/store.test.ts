import type { Reading, Vehicle } from "@giroweg/shared/schemas";
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

const V1 = "018f6d2a-0000-7000-8000-00000000a001";
const V2 = "018f6d2a-0000-7000-8000-00000000a002";
const R1 = "018f6d2a-0000-7000-8000-00000000b001";

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
