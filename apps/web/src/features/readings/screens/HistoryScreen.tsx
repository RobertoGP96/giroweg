"use client";

import { isDistanceUnit } from "@giroweg/shared/domain";
import { Car, Download, Navigation, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { capitalize, formatDayLabel, formatOdometerDistance } from "@/lib/format";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { ActiveTripBanner } from "@/features/trips/components/ActiveTripBanner";
import { TripRow } from "@/features/trips/components/TripRow";
import { useTrips } from "@/features/trips/hooks/useTrips";
import type { TripSummary } from "@/features/trips/repository";
import { useSelectedVehicle, useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { Button, EmptyState, ErrorState, FilterChip, IconButton, ListSkeleton, OfflineBanner, Screen, Spinner, TopBar, useNavigate } from "@/ui";
import { ReadingRow } from "../components/ReadingRow";
import { exportReadingsCsv } from "../export";
import { useReadings } from "../hooks/useReadings";
import type { ReadingEntry } from "../repository";

type Range = "week" | "month" | "all";
const RANGES: readonly Range[] = ["week", "month", "all"];

type Tab = "readings" | "trips";
const TABS: readonly Tab[] = ["readings", "trips"];
const isTab = (value: string | null): value is Tab => value === "readings" || value === "trips";

/** `?state=loading|empty|error` forces a state for design review. */
type ForcedState = "loading" | "empty" | "error" | null;

/** Local calendar day (YYYY-MM-DD) of an instant. */
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface DayGroup<T> {
  key: string;
  date: string;
  entries: T[];
  distance: number;
}

/** Groups items (already newest first) by the local day of `getIso`, summing `getDistance`. */
const groupByDay = <T,>(items: T[], getIso: (item: T) => string, getDistance: (item: T) => number): DayGroup<T>[] => {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const iso = getIso(item);
    const key = dayKey(iso);
    const group = groups.get(key) ?? { key, date: iso, entries: [], distance: 0 };
    group.entries.push(item);
    group.distance += getDistance(item);
    groups.set(key, group);
  }
  return [...groups.values()];
};

const readingIso = (entry: ReadingEntry): string => entry.reading.recordedAt;
const readingDistance = (entry: ReadingEntry): number => entry.delta ?? 0;
const tripIso = (summary: TripSummary): string => summary.trip.startedAt;
const tripDistance = (summary: TripSummary): number => summary.distance ?? 0;

const rangeStart = (range: Range, now: Date = new Date()): string | null => {
  if (range === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  return start.toISOString();
};

export function HistoryScreen() {
  const { t } = useTranslation();
  const { push, pending } = useNavigate();
  const params = useSearchParams();
  const forced = params.get("state") as ForcedState;
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const vehicles = useVehicles("active");
  const [chosenId, setChosenId] = useState<string | null>(params.get("vehicle"));
  const current = useSelectedVehicle(vehicles.data, chosenId);
  const readings = useReadings(current?.vehicle.id);
  const trips = useTrips(current?.vehicle.id);
  const [range, setRange] = useState<Range>("month");
  const [tab, setTab] = useState<Tab>(() => {
    const requested = params.get("tab");
    return isTab(requested) ? requested : "readings";
  });

  const listing = tab === "readings" ? readings : trips;
  const loading = forced === "loading" || vehicles.status === "loading" || (current !== undefined && listing.status === "loading");
  const failed = forced === "error" || vehicles.status === "error" || listing.status === "error";
  const noVehicles = !loading && !failed && vehicles.status === "success" && vehicles.data.length === 0;
  const since = rangeStart(range);
  const inRange = (iso: string): boolean => since === null || iso >= since;

  const entries = forced === "empty" ? [] : (readings.data ?? []);
  const filteredEntries = entries.filter((entry) => inRange(readingIso(entry)));
  const readingDays = groupByDay(filteredEntries, readingIso, readingDistance);

  const summaries = forced === "empty" ? [] : (trips.data ?? []);
  const filteredTrips = summaries.filter((summary) => inRange(tripIso(summary)));
  const tripDays = groupByDay(filteredTrips, tripIso, tripDistance);

  const shown = tab === "readings" ? filteredEntries.length : filteredTrips.length;
  const empty = !loading && !failed && !noVehicles && shown === 0;
  const unit = current?.vehicle.unit ?? "km";
  // Trips need a distance unit; hour meters get an explanation instead of the start button.
  const tripVehicle = current !== undefined && isDistanceUnit(current.vehicle.unit) ? current.vehicle : undefined;

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen>
        <ActiveTripBanner />
        <TopBar
          title={t("history.title")}
          large
          trailing={
            loading ? (
              <span className="flex items-center gap-2 text-label text-muted">
                <Spinner />
                {t("common.loading")}
              </span>
            ) : (
              tab === "readings" &&
              current &&
              entries.length > 0 && (
                <IconButton label={t("readings.exportCsv")} tone="elevated" className="size-11" onPress={() => exportReadingsCsv(current.vehicle, entries)}>
                  <Download className="size-5" strokeWidth={2} />
                </IconButton>
              )
            )
          }
        />

        {vehicles.data && vehicles.data.length > 1 && (
          <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-0.5">
            {vehicles.data.map((summary) => (
              <FilterChip key={summary.vehicle.id} selected={summary.vehicle.id === current?.vehicle.id} onClick={() => setChosenId(summary.vehicle.id)}>
                {summary.vehicle.name}
              </FilterChip>
            ))}
          </div>
        )}

        {!noVehicles && (
          <div className="flex gap-2" role="group" aria-label={t("history.tab")}>
            {TABS.map((option) => (
              <FilterChip key={option} selected={tab === option} onClick={() => setTab(option)}>
                {t(`history.${option}`)}
              </FilterChip>
            ))}
          </div>
        )}

        {!noVehicles && (
          <div className="flex gap-2">
            {RANGES.map((option) => (
              <FilterChip key={option} selected={range === option} onClick={() => setRange(option)}>
                {t(`history.${option}`)}
              </FilterChip>
            ))}
          </div>
        )}

        {loading && <ListSkeleton />}
        {failed && !loading && (
          <ErrorState
            onRetry={() => {
              vehicles.reload();
              readings.reload();
              trips.reload();
            }}
          />
        )}
        {noVehicles && (
          <EmptyState
            icon={<Car className="size-13" strokeWidth={1.8} aria-hidden />}
            title={t("vehicles.emptyTitle")}
            body={t("vehicles.emptyBody")}
            action={
              <Button size="lg" onPress={() => push("/vehicles/new")} isPending={pending} className="mt-2">
                <Plus className="size-5" strokeWidth={2.4} aria-hidden />
                {t("vehicles.add")}
              </Button>
            }
          />
        )}
        {empty && tab === "readings" && (
          <EmptyState
            title={t("states.emptyReadingsTitle")}
            body={t("states.emptyReadingsBody")}
            action={
              current && (
                <Button size="lg" onPress={() => push(`/readings/new?vehicle=${current.vehicle.id}`)} isPending={pending} className="mt-2">
                  <Plus className="size-5" strokeWidth={2.4} aria-hidden />
                  {t("states.addFirstReading")}
                </Button>
              )
            }
          />
        )}
        {empty && tab === "trips" && (
          <EmptyState
            icon={<Navigation className="size-13" strokeWidth={1.8} aria-hidden />}
            title={t("trips.emptyTitle")}
            body={tripVehicle ? t("trips.emptyBody") : t("trips.hoursVehicleBody")}
            action={
              tripVehicle && (
                <Button size="lg" onPress={() => push(`/trips/start?vehicle=${tripVehicle.id}`)} isPending={pending} className="mt-2">
                  <Navigation className="size-5" strokeWidth={2.4} aria-hidden />
                  {t("home.startTrip")}
                </Button>
              )
            }
          />
        )}

        {!loading &&
          !failed &&
          tab === "readings" &&
          readingDays.map((day) => (
            <section key={day.key} className="flex flex-col gap-2.5">
              <h2 className="mt-1 text-secondary font-semibold text-muted">
                {capitalize(formatDayLabel(day.date))}
                {day.distance > 0 && ` · +${formatOdometerDistance(day.distance, unit)}`}
              </h2>
              {day.entries.map((entry) => (
                <ReadingRow key={entry.reading.id} entry={entry} unit={unit} />
              ))}
            </section>
          ))}

        {!loading &&
          !failed &&
          tab === "trips" &&
          tripDays.map((day) => (
            <section key={day.key} className="flex flex-col gap-2.5">
              <h2 className="mt-1 text-secondary font-semibold text-muted">
                {capitalize(formatDayLabel(day.date))}
                {day.distance > 0 && ` · +${formatOdometerDistance(day.distance, unit)}`}
              </h2>
              {day.entries.map((summary) => (
                <TripRow key={summary.trip.id} summary={summary} unit={unit} />
              ))}
            </section>
          ))}
      </Screen>
    </>
  );
}
