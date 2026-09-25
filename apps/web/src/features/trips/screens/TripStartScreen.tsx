"use client";

import { isDistanceUnit } from "@giroweg/shared/domain";
import { Car, Clock, Navigation, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSession } from "@/db/hooks";
import { formatOdometerDistance } from "@/lib/format";
import { nowIso } from "@/lib/id";
import { ReadingRejectedError } from "@/features/readings/repository";
import { OdometerInput } from "@/features/readings/components/OdometerInput";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { VehicleTypeIcon } from "@/features/vehicles/components/VehicleTypeIcon";
import { useSelectedVehicle, useVehicles, type VehicleSummary } from "@/features/vehicles/hooks/useVehicles";
import { selectVehicle } from "@/features/vehicles/repository";
import { AlertCard, Button, Card, EmptyState, ErrorState, FilterChip, ListSkeleton, OfflineBanner, Screen, Spacer, TopBar, useNavigate } from "@/ui";
import { useActiveTrip } from "../hooks/useActiveTrip";
import { useGeolocationPermission } from "../hooks/useGeolocationPermission";
import { TripAlreadyActiveError, tripsRepository } from "../repository";
import { useTripStore } from "../store";
import { startTracking } from "../tracking";
import { requestWakeLock } from "../wakeLock";

/** `?state=loading|empty|error` forces a state for design review. */
type ForcedState = "loading" | "empty" | "error" | null;

const wakeLockUnsupported = (): boolean => typeof navigator !== "undefined" && !("wakeLock" in navigator);

/** Step 1 of 2: confirm the odometer at departure, then start recording. */
export function TripStartScreen() {
  const { t } = useTranslation();
  const { push, replace, prefetch, pending } = useNavigate();
  const params = useSearchParams();
  const forced = params.get("state") as ForcedState;
  const session = useLocalSession();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const permission = useGeolocationPermission();
  const active = useActiveTrip();
  const vehicles = useVehicles("active");
  const distanceVehicles: VehicleSummary[] | undefined = vehicles.data?.filter((summary) =>
    isDistanceUnit(summary.vehicle.unit),
  );
  const [chosenId, setChosenId] = useState<string | null>(params.get("vehicle"));
  const current = useSelectedVehicle(distanceVehicles, chosenId);

  // undefined = untouched (the current odometer is proposed); null = cleared by the driver.
  const [edited, setEdited] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<{ field: "value" | "form"; text: string } | null>(null);
  const [starting, setStarting] = useState(false);
  // Read once: the browser's support does not change while the screen lives.
  const [noWakeLock] = useState(wakeLockUnsupported);

  // A trip already running on this device goes straight to its screen.
  const resume = active.hydrated && active.tracking !== null;
  useEffect(() => {
    if (resume) replace("/trips/active");
  }, [resume, replace]);

  // The next screen and the map chunk must be ready before the driver leaves.
  useEffect(() => {
    prefetch("/trips/active");
    void import("../components/RouteMapCanvas");
  }, [prefetch]);

  const unit = current?.vehicle.unit ?? "km";
  const reference = current?.odometer ?? 0;
  const value = edited === undefined ? reference : edited;
  const delta = value !== null ? value - reference : null;

  const start = async () => {
    if (!current || value === null || starting || !isDistanceUnit(current.vehicle.unit)) return;
    const vehicleId = current.vehicle.id;
    const vehicleUnit = current.vehicle.unit;
    // Must run synchronously inside the user gesture or the browser refuses it.
    void requestWakeLock();
    setError(null);
    setStarting(true);
    try {
      const { trip, reading } = await tripsRepository.start({ vehicleId, value, recordedAt: nowIso() });
      useTripStore.getState().begin(
        startTracking({
          tripId: trip.id,
          vehicleId,
          unit: vehicleUnit,
          startReadingId: reading.id,
          startValue: reading.value,
          startedAt: reading.recordedAt,
          startedAtMs: Date.parse(reading.recordedAt),
        }),
      );
      selectVehicle(vehicleId);
      replace("/trips/active");
    } catch (cause) {
      setStarting(false);
      if (cause instanceof ReadingRejectedError) {
        const v = cause.validation;
        if (v.reason === "below_previous") {
          setError({ field: "value", text: t("readings.errors.invalidBelow", { value: formatOdometerDistance(v.previous.value, unit) }) });
        } else if (v.reason === "above_next") {
          setError({ field: "value", text: t("readings.errors.invalidAbove", { value: formatOdometerDistance(v.next.value, unit) }) });
        } else {
          setError({ field: "value", text: t("trips.errors.start") });
        }
      } else if (cause instanceof TripAlreadyActiveError) {
        setError({ field: "form", text: t("trips.errors.alreadyActive") });
      } else if (cause instanceof Error && cause.name === "NoSessionError") {
        setError({ field: "form", text: t("readings.errors.noSession") });
      } else {
        setError({ field: "form", text: t("trips.errors.start") });
      }
    }
  };

  const loading = forced === "loading" || vehicles.status === "loading" || !active.hydrated || resume;
  const failed = forced === "error" || vehicles.status === "error";
  const noVehicles = !loading && !failed && (forced === "empty" || (vehicles.status === "success" && vehicles.data.length === 0));
  const onlyHours = !loading && !failed && !noVehicles && distanceVehicles !== undefined && distanceVehicles.length === 0;
  const ready = !loading && !failed && !noVehicles && !onlyHours && current !== undefined && distanceVehicles !== undefined;

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen className="pt-1">
        <TopBar
          title={t("trips.startTitle")}
          backHref="/home"
          trailing={<span className="text-label font-semibold text-muted">{t("common.stepOf", { current: 1, total: 2 })}</span>}
        />

        {loading && <ListSkeleton />}
        {failed && !loading && <ErrorState onRetry={vehicles.reload} />}
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
        {onlyHours && (
          <EmptyState
            icon={<Clock className="size-13" strokeWidth={1.8} aria-hidden />}
            title={t("trips.hoursVehicleTitle")}
            body={t("trips.hoursVehicleBody")}
          />
        )}

        {ready && (
          <>
            {distanceVehicles.length > 1 && (
              <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-0.5">
                {distanceVehicles.map((summary) => (
                  <FilterChip
                    key={summary.vehicle.id}
                    selected={summary.vehicle.id === current.vehicle.id}
                    onClick={() => {
                      setChosenId(summary.vehicle.id);
                      setEdited(undefined);
                      setError(null);
                    }}
                  >
                    {summary.vehicle.name}
                  </FilterChip>
                ))}
              </div>
            )}

            <Card className="flex items-center gap-3 px-4 py-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
                <VehicleTypeIcon type={current.vehicle.type} className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold">
                  {current.vehicle.name}
                  {current.vehicle.plate && <span className="text-muted"> · {current.vehicle.plate}</span>}
                </div>
                <div className="text-label text-muted">{t("readings.lastValue", { value: formatOdometerDistance(reference, unit) })}</div>
              </div>
            </Card>

            <p className="text-secondary text-muted">{t("trips.startBody")}</p>
            <OdometerInput
              key={current.vehicle.id}
              value={value}
              onChange={(next) => {
                setEdited(next);
                if (error?.field === "value") setError(null);
              }}
              label={t("trips.startValue")}
              unit={unit}
              tone={error?.field === "value" ? "error" : "focused"}
            />
            {error?.field === "value" ? (
              <p role="alert" className="text-secondary font-semibold text-amber-text">
                {error.text}
              </p>
            ) : (
              <div className="flex justify-between text-secondary text-muted">
                <span>{t("readings.lastValue", { value: formatOdometerDistance(reference, unit) })}</span>
                {delta !== null && delta > 0 && (
                  <span className="font-semibold text-lime-text">{t("readings.delta", { value: formatOdometerDistance(delta, unit) })}</span>
                )}
              </div>
            )}

            {permission === "denied" && (
              <AlertCard title={t("trips.permissionDeniedTitle")} body={t("trips.permissionDeniedBody")} />
            )}
            {noWakeLock && <p className="text-label leading-relaxed text-muted">{t("trips.wakeLock.unsupported")}</p>}

            {error?.field === "form" && (
              <p role="alert" className="text-secondary font-semibold text-amber-text">
                {error.text}
              </p>
            )}

            <Spacer />
            <Button
              size="lg"
              isDisabled={value === null || starting || !session}
              isPending={starting}
              onPress={() => void start()}
            >
              <Navigation className="size-5" strokeWidth={2.4} aria-hidden />
              {t("trips.confirmAndStart")}
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
