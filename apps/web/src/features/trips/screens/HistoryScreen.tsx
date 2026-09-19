"use client";

import { ChevronDown, ListFilter } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { capitalize, formatDayLabel, formatDistance, formatNumber, formatShortDate, formatTime } from "@/lib/format";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Button, Card, EmptyState, ErrorState, FilterChip, IconButton, ListSkeleton, OfflineBanner, Screen, Spinner, TopBar } from "@/ui";
import { groupByDay, summarizeWeek, useTrips } from "../hooks/useTrips";
import type { TripSummary } from "../repository";

type Range = "week" | "month";

/** `?state=loading|empty|error` forces a state for design review. */
type ForcedState = "loading" | "empty" | "error" | null;

export function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("state") as ForcedState;
  const online = useOnlineStatus();
  const active = useActiveVehicle();
  const vehicle = active.data?.vehicle;
  const trips = useTrips(vehicle?.id);
  const [range, setRange] = useState<Range>("week");

  const loading = forced === "loading" || active.status === "loading" || trips.status === "loading";
  const failed = forced === "error" || active.status === "error" || trips.status === "error";
  const data = forced === "empty" ? [] : (trips.data ?? []);
  const empty = !loading && !failed && data.length === 0;
  const unit = vehicle?.unit ?? "km";

  const filtered = range === "week" ? data.filter((trip) => inCurrentWeek(trip)) : data;
  const days = groupByDay(filtered);
  const week = summarizeWeek(data);
  const delta = week.previousTotal > 0 ? ((week.total - week.previousTotal) / week.previousTotal) * 100 : 0;
  const max = Math.max(...week.days.map((d) => d.distance), 1);

  return (
    <>
      {!online && <OfflineBanner pendingCount={3} className="mt-2" />}
      <Screen className={cn(empty && "pb-3")}>
        <TopBar
          title={t("history.title")}
          large
          trailing={
            loading ? (
              <span className="flex items-center gap-2 text-label text-muted">
                <Spinner />
                {t("states.syncing")}
              </span>
            ) : (
              <IconButton label={t("common.filter")} tone="elevated" className="size-11">
                <ListFilter className="size-5" strokeWidth={2} />
              </IconButton>
            )
          }
        />

        {!loading && (
          <div className="flex gap-2">
            <FilterChip selected={range === "week"} onClick={() => setRange("week")}>{t("history.week")}</FilterChip>
            <FilterChip selected={range === "month"} onClick={() => setRange("month")}>{t("history.month")}</FilterChip>
            {vehicle?.plate && !empty && (
              <FilterChip>
                {vehicle.plate}
                <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
              </FilterChip>
            )}
          </div>
        )}

        {loading && <ListSkeleton />}
        {failed && !loading && <ErrorState onRetry={() => { active.reload(); trips.reload(); }} />}
        {empty && (
          <EmptyState
            title={t("states.emptyTripsTitle")}
            body={t("states.emptyTripsBody")}
            action={
              <Button size="lg" onPress={() => router.push("/shift/start")} className="mt-2">
                {t("states.startFirstShift")}
              </Button>
            }
          />
        )}

        {!loading && !failed && !empty && (
          <>
            <Card className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <div className="text-secondary text-muted">
                  {formatShortDate(week.start.toISOString())} – {formatShortDate(week.end.toISOString())}
                </div>
                {week.previousTotal > 0 && (
                  <div className={cn("font-display text-secondary font-semibold", delta >= 0 ? "text-lime-text" : "text-amber-text")}>
                    {t(delta >= 0 ? "history.vsPrevious" : "history.vsPreviousDown", { value: formatNumber(Math.abs(delta), 0) })}
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2 font-display">
                <span className="text-odometer font-bold leading-tight">{formatNumber(week.total)}</span>
                <span className="text-body-lg font-semibold text-muted">{unit}</span>
              </div>
              <div className="mt-3 flex h-14 items-end gap-1.5" role="img" aria-label={t("history.week")}>
                {week.days.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className={cn(
                      "flex-1 rounded-bar",
                      day.needsReview ? "bg-amber" : day.isToday ? "bg-lime" : "bg-track",
                    )}
                    style={{ height: `${Math.max((day.distance / max) * 100, day.distance > 0 ? 4 : 0)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5 text-nav text-muted" aria-hidden>
                {(t("history.days", { returnObjects: true }) as string[]).map((d, i) => (
                  <span key={i} className="flex-1 text-center">{d}</span>
                ))}
              </div>
            </Card>

            {days.map((day) => (
              <section key={day.key} className="flex flex-col gap-3.5">
                <h2 className="mt-1 text-secondary font-semibold text-muted">
                  {capitalize(formatDayLabel(day.date.toISOString()))} ·{" "}
                  {day.needsReview ? (
                    <span className="text-amber-text">
                      {formatDistance(day.distance, unit)} · {t("common.review")}
                    </span>
                  ) : (
                    formatDistance(day.distance, unit)
                  )}
                </h2>
                {day.trips.map((trip, index) => (
                  <TripRow key={trip.trip.id} trip={trip} index={day.trips.length - index} unit={unit} />
                ))}
              </section>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}

function TripRow({ trip, index, unit }: { trip: TripSummary; index: number; unit: string }) {
  const { t } = useTranslation();
  const morning = new Date(trip.trip.startedAt).getHours() < 14;
  return (
    <Link href={`/history/${trip.trip.id}`} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime">
      <Card className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 font-display text-secondary font-semibold">
          T{index}
        </div>
        <div className="flex-1">
          <div className="text-row font-semibold">{t(morning ? "history.shiftMorning" : "history.shiftAfternoon")}</div>
          <div className="text-label text-muted">
            {t("history.shiftLine", {
              start: formatTime(trip.trip.startedAt),
              end: trip.trip.endedAt ? formatTime(trip.trip.endedAt) : "—",
              deliveries: trip.trip.stops,
            })}
          </div>
        </div>
        <div className="font-display text-button font-semibold">{formatDistance(trip.distance, unit)}</div>
      </Card>
    </Link>
  );
}

const inCurrentWeek = (trip: TripSummary, now: Date = new Date()): boolean => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return new Date(trip.trip.startedAt) >= start;
};
