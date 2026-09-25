"use client";

import { roundToTenth } from "@giroweg/shared/domain";
import { Skeleton } from "@heroui/react";
import { CircleCheck, Route, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDistance, formatElapsed, formatOdometer, formatOdometerDistance, formatPercent, formatShortDate } from "@/lib/format";
import { OdometerInput } from "@/features/readings/components/OdometerInput";
import { ReadingRejectedError } from "@/features/readings/repository";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { recordSyncState, useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { AlertCard, Button, Card, EmptyState, ErrorState, Figure, ListSkeleton, OfflineBanner, OfflineState, Screen, Spacer, StatusPill, TopBar, useNavigate } from "@/ui";
import { RouteMap } from "../components/RouteMap";
import { useActiveTrip } from "../hooks/useActiveTrip";
import { useTripRoute } from "../hooks/useTripRoute";
import { useTrip } from "../hooks/useTrips";
import { tripsRepository, type TripSummary } from "../repository";

/** `?state=loading|empty|error` forces a state for design review. */
type ForcedState = "loading" | "empty" | "error" | null;

const SECONDS_PER_MINUTE = 60;

export function TripDetailScreen({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const params = useSearchParams();
  const forced = params.get("state") as ForcedState;
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const detail = useTrip(tripId);

  const loading = forced === "loading" || detail.status === "loading";
  const failed = forced === "error" || detail.status === "error";
  const summary = forced === "empty" || detail.status !== "success" ? undefined : detail.data;

  if (loading || failed || summary === undefined) {
    return (
      <>
        {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
        <Screen className="pt-1">
          <TopBar title={t("trips.detailTitle")} backHref="/history?tab=trips" />
          {loading && <ListSkeleton />}
          {failed && !loading && <ErrorState onRetry={detail.reload} />}
          {!loading && !failed && (
            <EmptyState
              icon={<Route className="size-13" strokeWidth={1.8} aria-hidden />}
              title={t("trips.notFoundTitle")}
              body={t("trips.notFoundBody")}
            />
          )}
        </Screen>
      </>
    );
  }

  return <TripDetail summary={summary} online={online} pendingCount={queue.length} />;
}

function TripDetail({ summary, online, pendingCount }: { summary: TripSummary; online: boolean; pendingCount: number }) {
  const { t } = useTranslation();
  const { push, pending } = useNavigate();
  const { trip, vehicle, start, end, distance, gps, durationSeconds, state } = summary;
  const route = useTripRoute(trip.id);
  const tripSync = useRecordSync(trip.id);
  const outbox = useSyncQueue();
  const active = useActiveTrip();
  const [fixValue, setFixValue] = useState<number | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  const unit = vehicle?.unit ?? "km";
  const backHref = `/history?vehicle=${trip.vehicleId}&tab=trips`;
  const runningHere = active.tracking?.tripId === trip.id;
  const endRejected = trip.endReadingId !== null && recordSyncState(outbox, trip.endReadingId) === "error";
  const distanceText = distance === null ? "—" : formatDistance(distance, unit);

  const fixEndReading = async () => {
    if (fixValue === null || fixing) return;
    setFixing(true);
    setFixError(null);
    try {
      await tripsRepository.replaceEndReading(trip.id, roundToTenth(fixValue), t("trips.voidReasonRejected"));
      setFixValue(null);
    } catch (cause) {
      if (cause instanceof ReadingRejectedError) {
        const v = cause.validation;
        if (v.reason === "below_previous") {
          setFixError(t("readings.errors.invalidBelow", { value: formatOdometerDistance(v.previous.value, unit) }));
        } else if (v.reason === "above_next") {
          setFixError(t("readings.errors.invalidAbove", { value: formatOdometerDistance(v.next.value, unit) }));
        } else {
          setFixError(t("trips.errors.finish"));
        }
      } else {
        setFixError(t("trips.errors.finish"));
      }
    } finally {
      setFixing(false);
    }
  };

  return (
    <>
      {!online && <OfflineBanner pendingCount={pendingCount} className="mt-2" />}
      <Screen className="pt-1">
        <TopBar title={t("trips.detailDate", { date: formatShortDate(trip.startedAt) })} backHref={backHref} />

        {state === "cancelled" && <AlertCard emphasized title={t("trips.cancelled")} body={t("trips.cancelBody")} />}

        {route.status === "loading" && <Skeleton className="h-72 rounded-lg" aria-label={t("trips.routeLoading")} />}
        {route.status === "error" && (
          <Card tone="nested" padding="lg" className="flex h-72 items-center justify-center">
            <p className="text-body text-muted text-center text-pretty">{t("states.errorBody")}</p>
          </Card>
        )}
        {route.status === "success" &&
          (route.data.kind === "none" ? (
            <Card tone="nested" padding="lg" className="flex h-72 flex-col items-center justify-center gap-3 text-center">
              <Route className="size-8 text-muted" strokeWidth={1.8} aria-hidden />
              <p className="text-body text-muted text-pretty">{t("trips.routeEmpty")}</p>
            </Card>
          ) : route.data.kind === "offline" ? (
            <Card tone="nested" padding="none" className="flex h-72 flex-col justify-center">
              <OfflineState />
              <p className="-mt-2 px-6 pb-4 text-center text-label text-muted">{t("trips.routeOffline")}</p>
            </Card>
          ) : (
            <RouteMap mode="detail" segments={route.data.route.segments} label={t("trips.mapLabel", { distance: distanceText })} />
          ))}

        <Card padding="lg">
          <div className="text-secondary text-muted">{vehicle?.name ?? t("trips.route")}</div>
          <Figure size="total" value={distance === null ? "—" : formatOdometer(distance)} unit={unit} className="mt-1" />
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card padding="sm">
            <div className="text-label text-muted">{t("trips.odometer")}</div>
            <div className="mt-0.5 font-display text-button font-semibold">
              {start ? formatOdometer(start.value) : "—"}
              <span className="text-muted"> → </span>
              {end ? formatOdometer(end.value) : "—"}
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("trips.gps")}</div>
            <div className="mt-0.5 font-display text-button font-semibold">
              {trip.gpsDistance === null ? "—" : formatDistance(trip.gpsDistance, unit)}
            </div>
            {gps && (
              <div className={cn("mt-0.5 flex items-center gap-1 text-label font-semibold", gps.withinMargin ? "text-lime-text" : "text-amber-text")}>
                {gps.withinMargin ? (
                  <CircleCheck className="size-3.5" strokeWidth={2.4} aria-hidden />
                ) : (
                  <TriangleAlert className="size-3.5" strokeWidth={2.4} aria-hidden />
                )}
                {formatPercent(gps.ratio)}
                {!gps.withinMargin && ` · ${t("trips.review")}`}
              </div>
            )}
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("trips.duration")}</div>
            <div className="mt-0.5 font-display text-button font-semibold">
              {durationSeconds === null ? "—" : formatElapsed(durationSeconds)}
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("trips.pauses")}</div>
            <div className="mt-0.5 font-display text-button font-semibold">
              {t("trips.pausesSummary", { count: trip.pauses, minutes: Math.round(trip.pausedSeconds / SECONDS_PER_MINUTE) })}
            </div>
          </Card>
        </div>

        <Card padding="none" className="flex flex-col">
          <DetailRow label={t("trips.startValue")} value={start ? formatDateTime(start.recordedAt) : "—"} />
          <DetailRow label={t("trips.endValue")} value={end ? formatDateTime(end.recordedAt) : "—"} />
          {trip.reason && <DetailRow label={t("trips.reason")} value={trip.reason} />}
          <DetailRow label={t("sync.state.label")} value={<SyncBadge state={tripSync} showLabel />} last />
        </Card>

        {endRejected && (
          <Card tone="alert" className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="size-6 shrink-0 text-amber-text" strokeWidth={2} aria-hidden />
              <div>
                <div className="text-body font-semibold">{t("trips.fixEndReading")}</div>
                <p className="mt-0.5 text-label leading-relaxed text-muted">{t("trips.fixEndReadingBody")}</p>
              </div>
            </div>
            <OdometerInput
              value={fixValue}
              onChange={(next) => {
                setFixValue(next);
                setFixError(null);
              }}
              label={t("trips.endValue")}
              unit={unit}
              tone={fixError ? "error" : "focused"}
            />
            {fixError && (
              <p role="alert" className="text-secondary font-semibold text-amber-text">
                {fixError}
              </p>
            )}
            <Button size="md" isDisabled={fixValue === null || fixing} isPending={fixing} onPress={() => void fixEndReading()}>
              {t("trips.fixEndReading")}
            </Button>
          </Card>
        )}

        <Spacer />

        {state === "open" &&
          (runningHere ? (
            <Button size="lg" onPress={() => push("/trips/active")} isPending={pending}>
              {t("trips.continue")}
            </Button>
          ) : (
            <div className="flex justify-center">
              <StatusPill tone="lime">{t("trips.inProgressElsewhere")}</StatusPill>
            </div>
          ))}
      </Screen>
    </>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 px-4 py-3", !last && "border-b border-line")}>
      <span className="text-body text-muted">{label}</span>
      <span className="ml-auto text-right text-body font-medium">{value}</span>
    </div>
  );
}
