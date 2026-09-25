"use client";

import { Car, Download, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { capitalize, formatDayLabel, formatOdometerDistance } from "@/lib/format";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { useSelectedVehicle, useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { Button, EmptyState, ErrorState, FilterChip, IconButton, ListSkeleton, OfflineBanner, Screen, Spinner, TopBar, useNavigate } from "@/ui";
import { ReadingRow } from "../components/ReadingRow";
import { exportReadingsCsv } from "../export";
import { useReadings } from "../hooks/useReadings";
import type { ReadingEntry } from "../repository";

type Range = "week" | "month" | "all";
const RANGES: readonly Range[] = ["week", "month", "all"];

/** `?state=loading|empty|error` forces a state for design review. */
type ForcedState = "loading" | "empty" | "error" | null;

/** Local calendar day (YYYY-MM-DD) of an instant. */
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface DayGroup {
  key: string;
  date: string;
  entries: ReadingEntry[];
  distance: number;
}

/** Groups entries (already newest first) by local day. */
const groupByDay = (entries: ReadingEntry[]): DayGroup[] => {
  const groups = new Map<string, DayGroup>();
  for (const entry of entries) {
    const key = dayKey(entry.reading.recordedAt);
    const group = groups.get(key) ?? { key, date: entry.reading.recordedAt, entries: [], distance: 0 };
    group.entries.push(entry);
    group.distance += entry.delta ?? 0;
    groups.set(key, group);
  }
  return [...groups.values()];
};

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
  const [range, setRange] = useState<Range>("month");

  const loading = forced === "loading" || vehicles.status === "loading" || (current !== undefined && readings.status === "loading");
  const failed = forced === "error" || vehicles.status === "error" || readings.status === "error";
  const noVehicles = !loading && !failed && vehicles.status === "success" && vehicles.data.length === 0;
  const entries = forced === "empty" ? [] : (readings.data ?? []);
  const since = rangeStart(range);
  const filtered = since ? entries.filter((entry) => entry.reading.recordedAt >= since) : entries;
  const days = groupByDay(filtered);
  const empty = !loading && !failed && !noVehicles && filtered.length === 0;
  const unit = current?.vehicle.unit ?? "km";

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen>
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
        {empty && (
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

        {!loading &&
          !failed &&
          days.map((day) => (
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
      </Screen>
    </>
  );
}
