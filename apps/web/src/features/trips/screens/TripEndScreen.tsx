"use client";

import { metersToUnit, roundToTenth, suggestedEndReading, tripDistance } from "@giroweg/shared/domain";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSession } from "@/db/hooks";
import { formatElapsed, formatOdometerDistance } from "@/lib/format";
import { OdometerInput } from "@/features/readings/components/OdometerInput";
import { ReadingRejectedError } from "@/features/readings/repository";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { useVehicle } from "@/features/vehicles/hooks/useVehicles";
import { AlertCard, Button, Card, OfflineBanner, Screen, Spacer, Stat, TextArea, TopBar, useNavigate } from "@/ui";
import { RouteSkeleton } from "@/ui/RouteSkeleton";
import { GpsComparisonCard } from "../components/GpsComparisonCard";
import { useActiveTrip } from "../hooks/useActiveTrip";
import { useEndTrip } from "../hooks/useEndTrip";
import { useTripTracker } from "../hooks/useTripTracker";
import { useWakeLock } from "../hooks/useWakeLock";
import { clearTripSnapshot } from "../snapshot";
import { useTripStore } from "../store";
import { finishTracking, pausedSeconds, type TrackingState } from "../tracking";
import { releaseWakeLock } from "../wakeLock";

/** Two accepted fixes are the minimum for a measured distance. */
const MIN_FIXES_FOR_DISTANCE = 2;

interface FrozenSummary {
  suggested: number | null;
  gpsDistance: number | null;
  gaps: number;
  pauses: number;
  pausedSeconds: number;
  pointCount: number;
}

/** The figures shown on the screen, fixed when it opens (the trip is frozen). */
const freezeSummary = (tracking: TrackingState, nowMs: number): FrozenSummary => {
  const measurable = tracking.acceptedFixes >= MIN_FIXES_FOR_DISTANCE;
  return {
    suggested: suggestedEndReading(tracking.startValue, measurable ? tracking.distanceMeters : null, tracking.unit),
    gpsDistance: measurable ? roundToTenth(metersToUnit(tracking.distanceMeters, tracking.unit)) : null,
    gaps: tracking.gaps,
    pauses: tracking.pauses,
    pausedSeconds: pausedSeconds(tracking, nowMs),
    pointCount: tracking.segments.reduce((n, segment) => n + segment.length, 0),
  };
};

/** Step 2 of 2: confirm the odometer at arrival and save the trip. */
export function TripEndScreen() {
  const { replace } = useNavigate();
  const { hydrated, tracking, elapsed } = useActiveTrip();
  // The watch stays alive so going back resumes at once; fixes are ignored while ending.
  useTripTracker(true);
  useWakeLock(true);

  const gone = hydrated && tracking === null;
  useEffect(() => {
    if (gone) replace("/home", "back");
  }, [gone, replace]);

  if (!hydrated || tracking === null) return <RouteSkeleton variant="flow" />;
  // Keyed by trip so the frozen figures and the form reset for a new trip.
  return <TripEndForm key={tracking.tripId} tracking={tracking} elapsed={elapsed} />;
}

function TripEndForm({ tracking, elapsed }: { tracking: TrackingState; elapsed: number }) {
  const { t } = useTranslation();
  const { back, replace, pending } = useNavigate();
  const session = useLocalSession();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const vehicle = useVehicle(tracking.vehicleId);
  const { end } = useEndTrip();
  // Fixed on mount: the state is frozen, so the figures must not drift with the clock.
  const [summary] = useState(() => freezeSummary(tracking, Date.now()));
  const [value, setValue] = useState<number | null>(summary.suggested);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field: "value" | "form"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { unit, startValue } = tracking;
  const vehicleName = vehicle.data?.vehicle.name;
  const odometerDistance = value === null ? null : tripDistance(startValue, value);

  const goBack = () => {
    useTripStore.getState().unfreeze();
    back("/trips/active");
  };

  const save = async () => {
    if (value === null || saving || !session) return;
    setError(null);
    setSaving(true);
    try {
      const closing = finishTracking(tracking, Date.now());
      const rounded = roundToTenth(value);
      const source = summary.suggested !== null && rounded === summary.suggested ? "trip" : "manual";
      await end({
        tripId: tracking.tripId,
        value: rounded,
        recordedAt: closing.recordedAt,
        source,
        gpsDistance: closing.gpsDistance,
        pauses: closing.pauses,
        pausedSeconds: closing.pausedSeconds,
        reason: reason.trim() === "" ? null : reason.trim(),
        // The schema takes mutable tuples; the tracker keeps readonly ones.
        segments: closing.segments.map((segment) => segment.map((p): [number, number, number, number] => [p[0], p[1], p[2], p[3]])),
      });
      useTripStore.getState().clear();
      clearTripSnapshot();
      void releaseWakeLock();
      replace(`/trips/${tracking.tripId}`, "back");
    } catch (cause) {
      setSaving(false);
      if (cause instanceof ReadingRejectedError) {
        const v = cause.validation;
        if (v.reason === "below_previous") {
          setError({ field: "value", text: t("readings.errors.invalidBelow", { value: formatOdometerDistance(v.previous.value, unit) }) });
        } else if (v.reason === "above_next") {
          setError({ field: "value", text: t("readings.errors.invalidAbove", { value: formatOdometerDistance(v.next.value, unit) }) });
        } else {
          setError({ field: "value", text: t("trips.errors.finish") });
        }
      } else if (cause instanceof Error && cause.name === "NoSessionError") {
        setError({ field: "form", text: t("readings.errors.noSession") });
      } else {
        setError({ field: "form", text: t("trips.errors.finish") });
      }
    }
  };

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen className="pt-1">
        <TopBar
          title={t("trips.endTitle")}
          onBack={goBack}
          trailing={<span className="text-label font-semibold text-muted">{t("common.stepOf", { current: 2, total: 2 })}</span>}
        />

        {vehicleName && <p className="text-secondary text-muted">{vehicleName}</p>}
        <OdometerInput
          value={value}
          onChange={(next) => {
            setValue(next);
            if (error?.field === "value") setError(null);
          }}
          label={t("trips.endValue")}
          unit={unit}
          tone={error?.field === "value" ? "error" : "focused"}
        />
        {error?.field === "value" ? (
          <p role="alert" className="text-secondary font-semibold text-amber-text">
            {error.text}
          </p>
        ) : (
          <div className="flex flex-col gap-1 text-secondary text-muted">
            <span className={summary.suggested !== null ? "font-semibold text-lime-text" : undefined}>
              {summary.suggested !== null
                ? t("trips.suggestedBy", { value: formatOdometerDistance(summary.suggested, unit) })
                : t("trips.noSuggestion")}
            </span>
            <span>{t("trips.startedAt", { value: formatOdometerDistance(startValue, unit) })}</span>
          </div>
        )}

        <GpsComparisonCard odometerDistance={odometerDistance ?? 0} gpsDistance={summary.gpsDistance} unit={unit} />

        <Card padding="sm" className="grid grid-cols-3 gap-3">
          <Stat label={t("trips.time")} value={formatElapsed(elapsed)} />
          <Stat
            label={t("trips.pauses")}
            value={t("trips.pausesSummary", { count: summary.pauses, minutes: Math.round(summary.pausedSeconds / 60) })}
          />
          <Stat label={t("trips.points")} value={summary.pointCount} />
        </Card>

        {summary.gaps > 0 && (
          <AlertCard title={t("trips.gapsWarningTitle", { count: summary.gaps })} body={t("trips.gapsWarningBody")} />
        )}

        <TextArea
          label={`${t("trips.reason")} · ${t("common.optional")}`}
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
        />

        {error?.field === "form" && (
          <p role="alert" className="text-secondary font-semibold text-amber-text">
            {error.text}
          </p>
        )}

        <Spacer />
        <Button size="lg" isDisabled={value === null || saving || !session} isPending={saving || pending} onPress={() => void save()}>
          {t("trips.save")}
        </Button>
      </Screen>
    </>
  );
}
