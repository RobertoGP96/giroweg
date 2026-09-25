"use client";

import { metersToUnit, suggestedEndReading } from "@giroweg/shared/domain";
import { Flag, Pause, Play, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistance, formatElapsed, formatNumber, formatOdometer, formatSpeed } from "@/lib/format";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useVehicle } from "@/features/vehicles/hooks/useVehicles";
import { AlertCard, Button, Card, Figure, Stat, StatusPill, useNavigate } from "@/ui";
import { RouteSkeleton } from "@/ui/RouteSkeleton";
import { GpsStatusPill } from "../components/GpsStatusPill";
import { RouteMap } from "../components/RouteMap";
import { WakeLockPill } from "../components/WakeLockPill";
import { useActiveTrip, type ActiveTrip } from "../hooks/useActiveTrip";
import { useTripTracker } from "../hooks/useTripTracker";
import { useWakeLock } from "../hooks/useWakeLock";
import { tripsRepository } from "../repository";
import { clearTripSnapshot } from "../snapshot";
import { useTripStore } from "../store";
import type { TrackingState } from "../tracking";
import { releaseWakeLock } from "../wakeLock";

const SECONDS_PER_HOUR = 3600;
/** Two accepted fixes are the minimum for a measured distance. */
const MIN_FIXES_FOR_DISTANCE = 2;

const speedPerHour = (tracking: TrackingState): number | null =>
  tracking.speedMps === null || tracking.status === "paused"
    ? null
    : metersToUnit(tracking.speedMps * SECONDS_PER_HOUR, tracking.unit);

const estimatedOdometer = (tracking: TrackingState): number =>
  suggestedEndReading(
    tracking.startValue,
    tracking.acceptedFixes >= MIN_FIXES_FOR_DISTANCE ? tracking.distanceMeters : null,
    tracking.unit,
  ) ?? tracking.startValue;

/** The live map and figures of the trip being recorded. */
export function ActiveTripScreen() {
  const { replace } = useNavigate();
  const active = useActiveTrip();
  const { hydrated, tracking } = active;
  const status = tracking?.status;
  useTripTracker(status === "tracking" || status === "ending");
  const wakeLock = useWakeLock(tracking !== null && status !== "paused");

  // Coming back from the end screen: recording resumes.
  useEffect(() => {
    if (status === "ending") useTripStore.getState().unfreeze();
  }, [status]);

  const gone = hydrated && tracking === null;
  useEffect(() => {
    if (gone) replace("/home", "back");
  }, [gone, replace]);

  if (!hydrated || tracking === null) return <RouteSkeleton variant="flow" />;
  return <ActiveTripView tracking={tracking} active={active} wakeLock={wakeLock} />;
}

interface ActiveTripViewProps {
  tracking: TrackingState;
  active: ActiveTrip;
  wakeLock: ReturnType<typeof useWakeLock>;
}

function ActiveTripView({ tracking, active, wakeLock }: ActiveTripViewProps) {
  const { t } = useTranslation();
  const { push, replace, prefetch, pending } = useNavigate();
  const online = useOnlineStatus();
  const { snapshotFailed, elapsed, paused } = active;
  const vehicle = useVehicle(tracking.vehicleId);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prefetch("/trips/end");
  }, [prefetch]);

  const { unit } = tracking;
  const distance = metersToUnit(tracking.distanceMeters, unit);
  const speed = speedPerHour(tracking);
  const vehicleName = vehicle.data?.vehicle.name ?? "";

  const togglePause = () => {
    const store = useTripStore.getState();
    if (paused) store.resume(Date.now());
    else store.pause(Date.now());
  };

  const finish = () => {
    useTripStore.getState().freeze();
    push("/trips/end");
  };

  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      await tripsRepository.discard(tracking.tripId);
      useTripStore.getState().clear();
      clearTripSnapshot();
      void releaseWakeLock();
      replace("/home", "back");
    } catch {
      setCancelling(false);
      setError(t("trips.errors.cancel"));
    }
  };

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <RouteMap
        mode="live"
        segments={tracking.segments}
        label={t("trips.mapLabel", { distance: formatDistance(distance, unit) })}
        emptyText={t("trips.waitingGps")}
        className="rounded-none"
        onTilesFailed={setTilesFailed}
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-screen pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <GpsStatusPill gps={tracking.gps} accuracyM={tracking.lastAccuracyM} paused={paused} className="shadow-card" />
          <WakeLockPill state={wakeLock.state} onRetry={() => void wakeLock.retry()} className="pointer-events-auto" />
        </div>
        {(!online || tilesFailed) && (
          <div className="absolute inset-x-0 bottom-0 flex px-screen pb-3">
            <StatusPill tone="muted" className="shadow-card">
              <WifiOff className="size-3.5" strokeWidth={2.2} aria-hidden />
              {t("trips.mapOffline")}
            </StatusPill>
          </div>
        )}
      </RouteMap>

      <section className="flex flex-col gap-4 rounded-t-sheet bg-bg px-screen pt-4 pb-7 shadow-card">
        <div>
          <div className="text-secondary text-muted">
            {vehicleName ? `${vehicleName} · ` : ""}
            {t("trips.gpsDistance")}
          </div>
          <Figure size="display" value={formatNumber(distance, 1)} unit={unit} className="mt-1" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("trips.time")} value={formatElapsed(elapsed)} />
          <Stat
            label={t("trips.speed")}
            value={speed === null ? "—" : formatSpeed(speed)}
            {...(speed === null ? {} : { unit: t(`trips.speedUnit.${unit}`) })}
          />
          <Stat label={t("trips.estimatedOdometer")} value={formatOdometer(estimatedOdometer(tracking))} unit={unit} />
        </div>

        {snapshotFailed && (
          <p role="alert" className="text-label font-semibold text-amber-text">
            {t("trips.errors.snapshot")}
          </p>
        )}
        {tracking.gps === "denied" && (
          <AlertCard title={t("trips.permissionDeniedTitle")} body={t("trips.permissionDeniedBody")} />
        )}
        {error && (
          <p role="alert" className="text-secondary font-semibold text-amber-text">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onPress={togglePause} isDisabled={cancelling}>
            {paused ? (
              <Play className="size-5" strokeWidth={2.4} aria-hidden />
            ) : (
              <Pause className="size-5" strokeWidth={2.4} aria-hidden />
            )}
            {t(paused ? "trips.resume" : "trips.pause")}
          </Button>
          <Button size="lg" className="flex-[1.3]" onPress={finish} isPending={pending} isDisabled={cancelling}>
            <Flag className="size-5" strokeWidth={2.4} aria-hidden />
            {t("trips.finish")}
          </Button>
        </div>

        {confirmingCancel ? (
          <Card tone="alert" className="flex flex-col gap-3">
            <div className="text-body font-semibold">{t("trips.cancelTitle")}</div>
            <p className="text-secondary leading-relaxed text-muted">{t("trips.cancelBody")}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onPress={() => setConfirmingCancel(false)} isDisabled={cancelling}>
                {t("common.back")}
              </Button>
              <Button
                variant="destructive"
                size="md"
                className="flex-1 bg-surface-2"
                isDisabled={cancelling}
                isPending={cancelling}
                onPress={() => void cancel()}
              >
                {t("trips.cancelConfirm")}
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="destructive" size="md" onPress={() => setConfirmingCancel(true)}>
            {t("trips.cancel")}
          </Button>
        )}
      </section>
    </main>
  );
}
