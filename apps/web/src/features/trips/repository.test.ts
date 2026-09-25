import type { RoutePointInput, Vehicle } from "@giroweg/shared/schemas";
import { beforeEach, describe, expect, it } from "vitest";
import { getStore } from "@/db/client";
import { ReadingRejectedError, readingsRepository } from "@/features/readings/repository";
import {
  TripAlreadyActiveError,
  TripNotOpenError,
  TripUnitNotSupportedError,
  tripsRepository,
} from "./repository";

const ORG = "018f6d2a-0000-7000-8000-000000000001";
const USER = "user-1";
const V_KM = "018f6d2a-0000-7000-8000-00000000a001";
const V_H = "018f6d2a-0000-7000-8000-00000000a002";
const START_AT = "2026-09-19T10:00:00.000Z";
const END_AT = "2026-09-19T11:00:00.000Z";

const vehicle = (id: string, unit: Vehicle["unit"]): Vehicle => ({
  id,
  orgId: ORG,
  createdAt: START_AT,
  updatedAt: START_AT,
  syncedAt: null,
  type: "motorcycle",
  name: "Moto",
  brand: null,
  model: null,
  year: null,
  plate: null,
  photoPath: null,
  unit,
  initialValue: 0,
  archivedAt: null,
});

const routeSegments: RoutePointInput[][] = [
  [
    [-3.7, 40.4, 0, 5],
    [-3.71, 40.41, 1000, 5],
    [-3.72, 40.42, 2000, 5],
  ],
];

const startTrip = () => tripsRepository.start({ vehicleId: V_KM, value: 1000, recordedAt: START_AT });

const endInput = (tripId: string, value: number, extra: Partial<Parameters<typeof tripsRepository.end>[0]> = {}) => ({
  tripId,
  value,
  recordedAt: END_AT,
  source: "trip" as const,
  gpsDistance: 25.5,
  pauses: 1,
  pausedSeconds: 60,
  reason: "Delivery",
  segments: routeSegments,
  ...extra,
});

describe("tripsRepository", () => {
  beforeEach(() => {
    const store = getStore();
    store.reset();
    store.setSession({ userId: USER, orgId: ORG });
    store.applyRemote({ vehicles: [vehicle(V_KM, "km"), vehicle(V_H, "h")] }, { replace: true });
    // Fixtures only: the outbox must start empty for the ordering assertions.
    store.ackOutbox(store.outbox.map((entry) => entry.id));
  });

  it("start writes the reading and the open trip, readings before trips in the outbox", async () => {
    const { trip, reading } = await startTrip();
    const store = getStore();
    expect(reading.source).toBe("manual");
    expect(reading.value).toBe(1000);
    expect(trip.startReadingId).toBe(reading.id);
    expect(trip.endedAt).toBeNull();
    expect(trip.startedAt).toBe(START_AT);
    expect(store.table("trips")).toHaveLength(1);
    expect(store.outbox.map((entry) => entry.table)).toEqual(["readings", "trips"]);
    expect(await tripsRepository.findOpen()).toEqual(trip);
    expect(await tripsRepository.findOpen(V_KM)).toEqual(trip);
    expect(await tripsRepository.findOpen(V_H)).toBeUndefined();
  });

  it("start rejects vehicles measured in hours and writes nothing", async () => {
    await expect(
      tripsRepository.start({ vehicleId: V_H, value: 10, recordedAt: START_AT }),
    ).rejects.toBeInstanceOf(TripUnitNotSupportedError);
    expect(getStore().table("readings")).toHaveLength(0);
    expect(getStore().table("trips")).toHaveLength(0);
    expect(getStore().outbox).toHaveLength(0);
  });

  it("start refuses a second open trip on the same vehicle", async () => {
    await startTrip();
    await expect(
      tripsRepository.start({ vehicleId: V_KM, value: 1001, recordedAt: END_AT }),
    ).rejects.toBeInstanceOf(TripAlreadyActiveError);
    expect(getStore().table("trips")).toHaveLength(1);
  });

  it("end below the start reading is rejected (rule 2) and writes nothing", async () => {
    const { trip } = await startTrip();
    const before = getStore().version;
    await expect(tripsRepository.end(endInput(trip.id, 999))).rejects.toBeInstanceOf(ReadingRejectedError);
    expect(getStore().version).toBe(before);
    expect(getStore().table("readings")).toHaveLength(1);
    expect((await tripsRepository.findOpen())?.id).toBe(trip.id);
    expect(getStore().table("tripRoutes")).toHaveLength(0);
  });

  it("end writes the trip reading, the trip fields and the route", async () => {
    const { trip: open } = await startTrip();
    const { trip, reading, route } = await tripsRepository.end(endInput(open.id, 1025));
    expect(reading.source).toBe("trip");
    expect(reading.value).toBe(1025);
    expect(reading.recordedAt).toBe(END_AT);
    expect(trip).toMatchObject({
      endReadingId: reading.id,
      endedAt: END_AT,
      gpsDistance: 25.5,
      pauses: 1,
      pausedSeconds: 60,
      reason: "Delivery",
    });
    expect(route).not.toBeNull();
    expect(route?.tripId).toBe(trip.id);
    expect(route?.pointCount).toBe(3);
    expect(getStore().table("tripRoutes")).toHaveLength(1);
    expect(getStore().outbox.map((entry) => entry.table)).toEqual(["readings", "trips", "readings", "trips", "tripRoutes"]);

    const summary = await tripsRepository.getById(trip.id);
    expect(summary?.state).toBe("ended");
    expect(summary?.distance).toBe(25);
    expect(summary?.gps?.withinMargin).toBe(true);
    expect(summary?.durationSeconds).toBe(3600);
    expect(summary?.needsReview).toBe(false);
  });

  it("end stores no route when the segments have fewer than two points", async () => {
    const { trip: open } = await startTrip();
    const { route } = await tripsRepository.end(
      endInput(open.id, 1025, { segments: [[[-3.7, 40.4, 0, 5]]], gpsDistance: null }),
    );
    expect(route).toBeNull();
    expect(getStore().table("tripRoutes")).toHaveLength(0);
    expect(getStore().outbox.map((entry) => entry.table)).toEqual(["readings", "trips", "readings", "trips"]);
  });

  it("end reuses the id of a route the device already has for the trip", async () => {
    const { trip: open } = await startTrip();
    const existingId = "018f6d2a-0000-7000-8000-00000000c001";
    getStore().applyRemote(
      {
        tripRoutes: [
          {
            id: existingId,
            orgId: ORG,
            createdAt: START_AT,
            updatedAt: START_AT,
            syncedAt: null,
            tripId: open.id,
            segments: [routeSegments[0]?.slice(0, 2) ?? []],
            pointCount: 2,
          },
        ],
      },
      { replace: false },
    );
    const { route } = await tripsRepository.end(endInput(open.id, 1025));
    expect(route?.id).toBe(existingId);
    expect(route?.pointCount).toBe(3);
    expect(getStore().table("tripRoutes")).toHaveLength(1);
  });

  it("end refuses a trip that is already closed", async () => {
    const { trip: open } = await startTrip();
    await tripsRepository.end(endInput(open.id, 1025));
    await expect(tripsRepository.end(endInput(open.id, 1030))).rejects.toBeInstanceOf(TripNotOpenError);
    expect(getStore().table("readings")).toHaveLength(2);
  });

  it("replaceEndReading voids the old reading and points the trip at the new one", async () => {
    const { trip: open } = await startTrip();
    const ended = await tripsRepository.end(endInput(open.id, 1025));
    const { trip, reading } = await tripsRepository.replaceEndReading(open.id, 1030, "Typo in the odometer");
    const old = getStore()
      .table("readings")
      .find((r) => r.id === ended.reading.id);
    expect(old?.voidedAt).not.toBeNull();
    expect(old?.voidReason).toBe("Typo in the odometer");
    expect(reading.value).toBe(1030);
    expect(reading.source).toBe("manual");
    expect(reading.recordedAt).toBe(END_AT);
    expect(trip.endReadingId).toBe(reading.id);
    expect(trip.endedAt).toBe(END_AT);
    expect((await tripsRepository.getById(open.id))?.distance).toBe(30);
  });

  it("discard closes the trip without an end reading and keeps the start reading", async () => {
    const { trip: open, reading } = await startTrip();
    const trip = await tripsRepository.discard(open.id);
    expect(trip.endedAt).not.toBeNull();
    expect(trip.endReadingId).toBeNull();
    expect(await tripsRepository.findOpen()).toBeUndefined();
    expect(getStore().table("readings")).toEqual([reading]);
    const summary = await tripsRepository.getById(open.id);
    expect(summary?.state).toBe("cancelled");
    expect(summary?.distance).toBeNull();
  });

  it("summaries flag a voided end reading for review", async () => {
    const { trip: open } = await startTrip();
    const { reading } = await tripsRepository.end(endInput(open.id, 1025));
    await readingsRepository.void(reading.id, "Wrong vehicle");
    const summary = await tripsRepository.getById(open.id);
    expect(summary?.distance).toBeNull();
    expect(summary?.gps).toBeNull();
    expect(summary?.needsReview).toBe(true);
    expect(summary?.state).toBe("ended");
  });

  it("lists open trips first, then newest first", async () => {
    const first = await startTrip();
    await tripsRepository.end(endInput(first.trip.id, 1025));
    const second = await tripsRepository.start({ vehicleId: V_KM, value: 1030, recordedAt: "2026-09-20T10:00:00.000Z" });
    const list = await tripsRepository.listByVehicle(V_KM);
    expect(list.map((s) => s.trip.id)).toEqual([second.trip.id, first.trip.id]);
    expect(list[0]?.state).toBe("open");
    expect(await tripsRepository.listAll()).toHaveLength(2);
  });
});
