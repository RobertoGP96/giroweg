"use client";

import { Check, Route } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDistance, formatOdometer, formatOdometerDistance, formatShortDate, formatTime } from "@/lib/format";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { Card, navOptions } from "@/ui";
import type { TripSummary } from "../repository";

interface TripRowProps {
  summary: TripSummary;
  unit: string;
  /** Show the date instead of just the time (lists not grouped by day). */
  withDate?: boolean;
}

/** One trip in a list: odometer span, GPS figure, distance and sync state. */
export function TripRow({ summary, unit, withDate = false }: TripRowProps) {
  const { t } = useTranslation();
  const { trip, start, end, distance, needsReview, state } = summary;
  const sync = useRecordSync(trip.id);
  const when = withDate
    ? `${formatShortDate(trip.startedAt)} · ${formatTime(trip.startedAt)}`
    : formatTime(trip.startedAt);

  const title =
    state === "ended" && start && end
      ? t("trips.rowLine", { start: formatOdometer(start.value), end: formatOdometer(end.value) })
      : state === "open"
        ? t("trips.open")
        : t("trips.cancelled");

  const gpsText =
    trip.gpsDistance === null ? null : t("trips.rowGps", { value: formatDistance(trip.gpsDistance, unit) });

  return (
    <Link
      href={`/trips/${trip.id}`}
      {...navOptions("forward")}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <Card className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2",
            needsReview ? "text-amber-text" : state === "open" ? "text-lime-text" : "text-muted",
          )}
        >
          <Route className="size-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("font-display text-button font-semibold", state === "cancelled" && "text-muted")}>
            {title}
          </div>
          <div className="flex items-center gap-1 truncate text-label text-muted">
            <span>{when}</span>
            {gpsText && (
              <>
                <span aria-hidden>·</span>
                <span>{gpsText}</span>
                {needsReview ? (
                  <span className="font-semibold text-amber-text">· {t("trips.review")}</span>
                ) : (
                  <Check className="size-3.5 text-lime-text" strokeWidth={2.6} aria-hidden />
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {distance !== null && (
            <span className="font-display text-body font-semibold text-lime-text">
              +{formatOdometerDistance(distance, unit)}
            </span>
          )}
          <SyncBadge state={sync} />
        </div>
      </Card>
    </Link>
  );
}
