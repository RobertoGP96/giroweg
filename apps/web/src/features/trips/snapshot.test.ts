import type { GpsFix } from "@giroweg/shared/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_TRIP_KEY,
  loadTripSnapshot,
  saveTripSnapshot,
  startSnapshotPersister,
  type StorageLike,
} from "./snapshot";
import { useTripStore } from "./store";
import { startTracking, type TrackingState } from "./tracking";

const START_MS = Date.UTC(2026, 8, 25, 8, 0, 0);

const tracking = (): TrackingState =>
  startTracking({
    tripId: "trip-1",
    vehicleId: "vehicle-1",
    unit: "km",
    startReadingId: "reading-1",
    startValue: 120,
    startedAt: new Date(START_MS).toISOString(),
    startedAtMs: START_MS,
  });

const fix = (seconds: number, meters: number): GpsFix => ({
  lng: -3.7038 + meters / 84_700,
  lat: 40.4168,
  t: START_MS + seconds * 1000,
  accuracy: 6,
  speed: null,
});

class MemoryStorage implements StorageLike {
  private readonly items = new Map<string, string>();
  writes = 0;
  failing = false;

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    if (this.failing) throw new Error("QuotaExceededError");
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.writes += 1;
    this.items.delete(key);
  }
}

describe("snapshot round trip", () => {
  it("saves and loads the tracking state", () => {
    const storage = new MemoryStorage();
    const state = tracking();
    saveTripSnapshot(state, storage);
    expect(loadTripSnapshot(storage)).toEqual(state);
  });

  it("removes the key when saving null", () => {
    const storage = new MemoryStorage();
    saveTripSnapshot(tracking(), storage);
    saveTripSnapshot(null, storage);
    expect(storage.getItem(ACTIVE_TRIP_KEY)).toBeNull();
    expect(loadTripSnapshot(storage)).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(ACTIVE_TRIP_KEY, "{not json");
    expect(loadTripSnapshot(storage)).toBeNull();
  });

  it("returns null for invalid route points", () => {
    const storage = new MemoryStorage();
    const broken = { ...tracking(), segments: [[[200, 95, -1, 4]]] };
    storage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(broken));
    expect(loadTripSnapshot(storage)).toBeNull();
  });

  it("returns null when the storage throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(loadTripSnapshot(storage)).toBeNull();
  });
});

describe("startSnapshotPersister", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTripStore.setState({ hydrated: false, tracking: null, snapshotFailed: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes immediately when the trip starts, changes status or ends", () => {
    const storage = new MemoryStorage();
    const stop = startSnapshotPersister(useTripStore, { storage, throttleMs: 5000 });

    useTripStore.getState().begin(tracking());
    expect(storage.writes).toBe(1);
    expect(loadTripSnapshot(storage)?.status).toBe("tracking");

    useTripStore.getState().pause(START_MS + 10_000);
    expect(storage.writes).toBe(2);
    expect(loadTripSnapshot(storage)?.status).toBe("paused");

    useTripStore.getState().clear();
    expect(storage.writes).toBe(3);
    expect(storage.getItem(ACTIVE_TRIP_KEY)).toBeNull();
    stop();
  });

  it("throttles fix updates to a trailing write", () => {
    const storage = new MemoryStorage();
    const stop = startSnapshotPersister(useTripStore, { storage, throttleMs: 5000 });
    useTripStore.getState().begin(tracking());
    expect(storage.writes).toBe(1);

    useTripStore.getState().addFix(fix(1, 0));
    useTripStore.getState().addFix(fix(3, 30));
    useTripStore.getState().addFix(fix(5, 60));
    expect(storage.writes).toBe(1);
    expect(loadTripSnapshot(storage)?.acceptedFixes).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(storage.writes).toBe(2);
    expect(loadTripSnapshot(storage)?.acceptedFixes).toBe(3);

    stop();
  });

  it("flushes pending fixes when stopped", () => {
    const storage = new MemoryStorage();
    const stop = startSnapshotPersister(useTripStore, { storage, throttleMs: 5000 });
    useTripStore.getState().begin(tracking());
    useTripStore.getState().addFix(fix(1, 0));
    stop();
    expect(loadTripSnapshot(storage)?.acceptedFixes).toBe(1);
  });

  it("flags a failing storage and clears the flag on the next success", () => {
    const storage = new MemoryStorage();
    storage.failing = true;
    const stop = startSnapshotPersister(useTripStore, { storage, throttleMs: 5000 });

    useTripStore.getState().begin(tracking());
    expect(useTripStore.getState().snapshotFailed).toBe(true);

    storage.failing = false;
    useTripStore.getState().pause(START_MS + 10_000);
    expect(useTripStore.getState().snapshotFailed).toBe(false);
    expect(loadTripSnapshot(storage)?.status).toBe("paused");
    stop();
  });
});
