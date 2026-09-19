/**
 * Demo fixtures for the local store while there is no backend wired in.
 * All ids are fixed UUIDs so links between records are stable.
 */
import type { Tables } from "./store";

export const ORG_ID = "018f6d2a-0000-7000-8000-000000000001";
export const USER_ID = "018f6d2a-0000-7000-8000-000000000002";

export const VEHICLE_IDS = {
  pcx: "018f6d2a-0000-7000-8000-00000000a001",
  nv200: "018f6d2a-0000-7000-8000-00000000a002",
  tern: "018f6d2a-0000-7000-8000-00000000a003",
} as const;

const READING_IDS = {
  r0: "018f6d2a-0000-7000-8000-00000000b000",
  r1: "018f6d2a-0000-7000-8000-00000000b001",
  r2: "018f6d2a-0000-7000-8000-00000000b002",
  r4: "018f6d2a-0000-7000-8000-00000000b004",
  r5: "018f6d2a-0000-7000-8000-00000000b005",
  r6: "018f6d2a-0000-7000-8000-00000000b006",
  r7: "018f6d2a-0000-7000-8000-00000000b007",
  r8: "018f6d2a-0000-7000-8000-00000000b008",
  r9: "018f6d2a-0000-7000-8000-00000000b009",
  r10: "018f6d2a-0000-7000-8000-00000000b010",
  r11: "018f6d2a-0000-7000-8000-00000000b011",
  r12: "018f6d2a-0000-7000-8000-00000000b012",
} as const;

export const TRIP_IDS = {
  mon: "018f6d2a-0000-7000-8000-00000000c001",
  tue: "018f6d2a-0000-7000-8000-00000000c002",
  wed: "018f6d2a-0000-7000-8000-00000000c003",
  thu1: "018f6d2a-0000-7000-8000-00000000c004",
  thu2: "018f6d2a-0000-7000-8000-00000000c005",
  fri: "018f6d2a-0000-7000-8000-00000000c006",
  sat: "018f6d2a-0000-7000-8000-00000000c007",
} as const;

const RULE_IDS = {
  oil: "018f6d2a-0000-7000-8000-00000000d001",
  rearTyre: "018f6d2a-0000-7000-8000-00000000d002",
  brakePads: "018f6d2a-0000-7000-8000-00000000d003",
} as const;

/**
 * Fixture timestamps are relative to today so the demo always has a shift
 * "today" and a week of history whatever the current date. `at(daysAgo, hh, mm)`
 * is local time; `minutesAgo` keeps today's trip in the past.
 */
const at = (daysAgo: number, hours: number, minutes: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const audit = (id: string, createdAt: string) => ({
  id,
  orgId: ORG_ID,
  createdAt,
  updatedAt: createdAt,
  syncedAt: createdAt,
});

const reading = (
  id: string,
  vehicleId: string,
  value: number,
  recordedAt: string,
  source: "manual" | "ocr" | "trip" = "trip",
) => ({
  ...audit(id, recordedAt),
  vehicleId,
  value,
  recordedAt,
  source,
  photoPath: null,
  note: null,
  createdBy: USER_ID,
  voidedAt: null,
  voidReason: null,
  odometerReset: false,
});

/** A finished trip between two readings. */
const trip = (
  id: string,
  startReadingId: string,
  endReadingId: string,
  startedAt: string,
  endedAt: string,
  gpsDistance: number,
  stops: number,
  reason: string,
  pauses = 0,
  pausedSeconds = 0,
) => ({
  ...audit(id, endedAt),
  vehicleId: VEHICLE_IDS.pcx,
  startReadingId,
  endReadingId,
  startedAt,
  endedAt,
  gpsDistance,
  reason,
  stops,
  pauses,
  pausedSeconds,
});

export const seed: Tables = {
  vehicles: [
    {
      ...audit(VEHICLE_IDS.pcx, "2026-01-10T15:00:00.000Z"),
      type: "motorcycle",
      name: "Honda PCX 150",
      brand: "Honda",
      model: "PCX 150",
      year: 2024,
      plate: "MTR-482",
      photoPath: null,
      unit: "km",
      initialValue: 33_600,
      archivedAt: null,
    },
    {
      ...audit(VEHICLE_IDS.nv200, "2026-01-10T15:00:00.000Z"),
      type: "van",
      name: "Nissan NV200",
      brand: "Nissan",
      model: "NV200",
      year: 2021,
      plate: "VAN-207",
      photoPath: null,
      unit: "km",
      initialValue: 112_640,
      archivedAt: null,
    },
    {
      ...audit(VEHICLE_IDS.tern, "2026-01-10T15:00:00.000Z"),
      type: "bicycle",
      name: "Bici eléctrica Tern",
      brand: "Tern",
      model: "GSD",
      year: 2025,
      plate: "BK-014",
      photoPath: null,
      unit: "km",
      initialValue: 2_981,
      archivedAt: null,
    },
  ],
  readings: [
    reading(READING_IDS.r0, VEHICLE_IDS.pcx, 33_711, at(5, 7, 55)),
    reading(READING_IDS.r1, VEHICLE_IDS.pcx, 33_797, at(5, 13, 10)),
    reading(READING_IDS.r2, VEHICLE_IDS.pcx, 33_889, at(4, 13, 40)),
    reading(READING_IDS.r4, VEHICLE_IDS.pcx, 34_030, at(3, 18, 20)),
    reading(READING_IDS.r5, VEHICLE_IDS.pcx, 34_127, at(2, 7, 55)),
    reading(READING_IDS.r6, VEHICLE_IDS.pcx, 34_171, at(2, 12, 40)),
    reading(READING_IDS.r7, VEHICLE_IDS.pcx, 34_171, at(2, 15, 10)),
    reading(READING_IDS.r8, VEHICLE_IDS.pcx, 34_218, at(2, 20, 2)),
    reading(READING_IDS.r9, VEHICLE_IDS.pcx, 34_218, at(1, 8, 2), "ocr"),
    reading(READING_IDS.r10, VEHICLE_IDS.pcx, 34_301, at(1, 13, 14), "ocr"),
    reading(READING_IDS.r11, VEHICLE_IDS.pcx, 34_301, minutesAgo(230), "ocr"),
    reading(READING_IDS.r12, VEHICLE_IDS.pcx, 34_348.3, minutesAgo(38), "ocr"),
  ],
  trips: [
    trip(TRIP_IDS.mon, READING_IDS.r0, READING_IDS.r1, at(5, 7, 55), at(5, 13, 10), 85.1, 12, "Reparto Centro"),
    trip(TRIP_IDS.tue, READING_IDS.r1, READING_IDS.r2, at(4, 7, 50), at(4, 13, 40), 90.8, 13, "Reparto Sur"),
    trip(TRIP_IDS.wed, READING_IDS.r2, READING_IDS.r4, at(3, 7, 30), at(3, 18, 20), 128.4, 15, "Reparto largo Norte", 1, 1_800),
    trip(TRIP_IDS.thu1, READING_IDS.r5, READING_IDS.r6, at(2, 7, 55), at(2, 12, 40), 43.6, 11, "Roma Norte → Condesa"),
    trip(TRIP_IDS.thu2, READING_IDS.r7, READING_IDS.r8, at(2, 15, 10), at(2, 20, 2), 46.9, 13, "Condesa → Nápoles"),
    trip(TRIP_IDS.fri, READING_IDS.r9, READING_IDS.r10, at(1, 8, 2), at(1, 13, 14), 81.6, 14, "Roma Norte → Del Valle", 2, 2_280),
    trip(TRIP_IDS.sat, READING_IDS.r11, READING_IDS.r12, minutesAgo(230), minutesAgo(38), 46.4, 9, "Del Valle → Coyoacán"),
  ],
  expenses: [
    {
      ...audit("018f6d2a-0000-7000-8000-00000000e001", at(1, 8, 40)),
      vehicleId: VEHICLE_IDS.pcx,
      type: "fuel",
      amount: 412.5,
      currency: "MXN",
      litres: 17.4,
      readingId: READING_IDS.r10,
      receiptPath: null,
      note: "Pemex · Av. Universidad",
      occurredAt: at(1, 8, 40),
    },
  ],
  maintenanceRules: [
    {
      ...audit(RULE_IDS.oil, "2026-01-10T15:00:00.000Z"),
      vehicleId: VEHICLE_IDS.pcx,
      name: "oil",
      everyUnits: 3_000,
      everyDays: null,
      remindUnitsBefore: 300,
      active: true,
    },
    {
      ...audit(RULE_IDS.rearTyre, "2026-01-10T15:00:00.000Z"),
      vehicleId: VEHICLE_IDS.pcx,
      name: "rearTyre",
      everyUnits: 6_000,
      everyDays: null,
      remindUnitsBefore: 300,
      active: true,
    },
    {
      ...audit(RULE_IDS.brakePads, "2026-01-10T15:00:00.000Z"),
      vehicleId: VEHICLE_IDS.pcx,
      name: "brakePads",
      everyUnits: 10_000,
      everyDays: null,
      remindUnitsBefore: 300,
      active: true,
    },
  ],
  maintenanceEvents: [
    {
      ...audit("018f6d2a-0000-7000-8000-00000000f001", "2026-06-02T16:00:00.000Z"),
      ruleId: RULE_IDS.oil,
      vehicleId: VEHICLE_IDS.pcx,
      readingId: null,
      atValue: 31_500,
      doneAt: "2026-06-02T16:00:00.000Z",
      note: null,
    },
    {
      ...audit("018f6d2a-0000-7000-8000-00000000f002", "2026-05-12T16:00:00.000Z"),
      ruleId: RULE_IDS.rearTyre,
      vehicleId: VEHICLE_IDS.pcx,
      readingId: null,
      atValue: 31_000,
      doneAt: "2026-05-12T16:00:00.000Z",
      note: null,
    },
    {
      ...audit("018f6d2a-0000-7000-8000-00000000f003", "2026-04-01T16:00:00.000Z"),
      ruleId: RULE_IDS.brakePads,
      vehicleId: VEHICLE_IDS.pcx,
      readingId: null,
      atValue: 30_000,
      doneAt: "2026-04-01T16:00:00.000Z",
      note: null,
    },
  ],
};

/** The signed-in driver (until auth is wired to Supabase). */
export const currentUser = {
  id: USER_ID,
  name: "Mateo Ruiz",
  firstName: "Mateo",
  initials: "MR",
  role: "Repartidor",
  fleet: "Flota Centro CDMX",
  phone: "+52 55 4021 8837",
  activeVehicleId: VEHICLE_IDS.pcx,
} as const;
