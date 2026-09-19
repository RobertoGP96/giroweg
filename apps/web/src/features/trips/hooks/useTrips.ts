"use client";

import { useAsync } from "@/lib/useAsync";
import { tripsRepository, type TripSummary } from "../repository";

export const useTrips = (vehicleId: string | undefined) =>
  useAsync(async () => (vehicleId ? tripsRepository.listByVehicle(vehicleId) : []), [vehicleId]);

export const useTrip = (tripId: string) =>
  useAsync(async () => {
    const trip = await tripsRepository.getById(tripId);
    if (!trip) throw new Error("Trip not found");
    return trip;
  }, [tripId]);

/** Local calendar day (YYYY-MM-DD) of an instant. */
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export interface DaySummary {
  key: string;
  date: Date;
  trips: TripSummary[];
  distance: number;
  needsReview: boolean;
}

/** Groups trips by local day, newest day first. */
export const groupByDay = (trips: TripSummary[]): DaySummary[] => {
  const map = new Map<string, DaySummary>();
  for (const trip of trips) {
    const key = dayKey(trip.trip.startedAt);
    const existing = map.get(key);
    if (existing) {
      existing.trips.push(trip);
      existing.distance += trip.distance;
      existing.needsReview = existing.needsReview || trip.needsReview;
    } else {
      map.set(key, {
        key,
        date: new Date(trip.trip.startedAt),
        trips: [trip],
        distance: trip.distance,
        needsReview: trip.needsReview,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
};

export interface TodaySummary {
  distance: number;
  shifts: number;
  deliveries: number;
  hours: number;
  lastTrip: TripSummary | undefined;
}

export const summarizeToday = (trips: TripSummary[], now: Date = new Date()): TodaySummary => {
  const today = dayKey(now.toISOString());
  const todays = trips.filter((t) => dayKey(t.trip.startedAt) === today);
  return {
    distance: todays.reduce((sum, t) => sum + t.distance, 0),
    shifts: todays.length,
    deliveries: todays.reduce((sum, t) => sum + t.trip.stops, 0),
    hours: todays.reduce((sum, t) => sum + t.durationMinutes, 0) / 60,
    lastTrip: trips[0],
  };
};

export interface WeekSummary {
  /** Monday-first array of 7 days. */
  days: Array<{ date: Date; distance: number; needsReview: boolean; isToday: boolean }>;
  total: number;
  previousTotal: number;
  start: Date;
  end: Date;
}

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
};

export const summarizeWeek = (trips: TripSummary[], now: Date = new Date()): WeekSummary => {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - 7);
  const todayKey = dayKey(now.toISOString());

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dayKey(date.toISOString());
    const dayTrips = trips.filter((t) => dayKey(t.trip.startedAt) === key);
    return {
      date,
      distance: dayTrips.reduce((sum, t) => sum + t.distance, 0),
      needsReview: dayTrips.some((t) => t.needsReview),
      isToday: key === todayKey,
    };
  });

  const previousTotal = trips
    .filter((t) => {
      const at = new Date(t.trip.startedAt);
      return at >= prevStart && at < start;
    })
    .reduce((sum, t) => sum + t.distance, 0);

  return { days, total: days.reduce((sum, d) => sum + d.distance, 0), previousTotal, start, end };
};
