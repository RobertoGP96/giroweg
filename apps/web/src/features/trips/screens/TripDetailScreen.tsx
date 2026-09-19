"use client";

import { Camera, ChevronLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { capitalize, formatDistance, formatDuration, formatNumber, formatOdometer, formatPercent, formatShortDate, formatTime } from "@/lib/format";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Button, Card, ErrorState, Figure, IconButton, ListSkeleton } from "@/ui";
import { RouteMap } from "../components/RouteMap";
import { exportTripCsv } from "../export";
import { useTrip } from "../hooks/useTrips";

export function TripDetailScreen({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const active = useActiveVehicle();
  const trip = useTrip(tripId);
  const unit = active.data?.vehicle.unit ?? "km";

  if (trip.status === "loading") {
    return (
      <main className="flex flex-1 flex-col px-screen pt-4">
        <ListSkeleton />
      </main>
    );
  }
  if (trip.status === "error") {
    return (
      <main className="flex flex-1 flex-col">
        <ErrorState onRetry={trip.reload} />
      </main>
    );
  }

  const { trip: record, start, end, distance, durationMinutes, gps, needsReview } = trip.data;
  const morning = new Date(record.startedAt).getHours() < 14;
  const perDelivery = record.stops > 0 ? distance / record.stops : 0;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="relative">
        <RouteMap variant="detail" className="h-85" />
        <IconButton
          label={t("common.back")}
          tone="elevated"
          onPress={() => router.push("/history")}
          className="absolute top-4 left-4 size-11 bg-bg"
        >
          <ChevronLeft className="size-5.5" strokeWidth={2} />
        </IconButton>
      </div>

      <section className="relative -mt-6 flex flex-1 flex-col gap-3.5 rounded-t-sheet-sm bg-bg p-screen">
        <div>
          <div className="text-secondary text-muted">
            {capitalize(formatShortDate(record.startedAt))} · {t(morning ? "history.shiftMorning" : "history.shiftAfternoon")}
          </div>
          <h1 className="mt-0.5 font-display text-card-title font-semibold">{record.reason ?? t("history.tripDetail")}</h1>
        </div>
        <Figure size="ring" value={formatNumber(distance)} unit={unit} />

        <div className="grid grid-cols-2 gap-2.5">
          <Card padding="sm">
            <div className="text-label text-muted">{t("shift.odometer")}</div>
            <div className="mt-0.5 font-display text-body-lg font-semibold">
              {formatOdometer(start.value)} → {end ? formatOdometer(end.value) : "—"}
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("shift.gps")}</div>
            <div className="mt-0.5 font-display text-body-lg font-semibold">
              {record.gpsDistance !== null ? formatDistance(record.gpsDistance, unit) : "—"}{" "}
              {gps && (
                <span className={`text-secondary ${needsReview ? "text-amber-text" : "text-lime-text"}`}>
                  {needsReview ? "!" : "✓"} {formatPercent(gps.ratio)}
                </span>
              )}
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("history.duration")}</div>
            <div className="mt-0.5 font-display text-body-lg font-semibold">{formatDuration(durationMinutes)}</div>
          </Card>
          <Card padding="sm">
            <div className="text-label text-muted">{t("shift.deliveries")}</div>
            <div className="mt-0.5 font-display text-body-lg font-semibold">
              {t("history.perDelivery", { count: record.stops, distance: formatDistance(perDelivery, unit) })}
            </div>
          </Card>
        </div>

        <div className="flex items-center gap-2.5 text-secondary text-muted">
          <div className="flex size-9 items-center justify-center rounded-segment bg-surface-2 text-text">
            <Camera className="size-4.5" strokeWidth={2} aria-hidden />
          </div>
          {t("history.photos", { count: end ? 2 : 1, time: formatTime(record.endedAt ?? record.startedAt) })}
        </div>

        <div className="flex-1" aria-hidden />
        <Button variant="outline" size="md" className="mb-4 text-body-lg" onPress={() => exportTripCsv(trip.data, unit)}>
          <Download className="size-5" strokeWidth={2} aria-hidden />
          {t("history.exportTrip")}
        </Button>
      </section>
    </main>
  );
}
