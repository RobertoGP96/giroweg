"use client";

import { compareGpsWithOdometer } from "@giroweg/shared/domain";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDistance, formatPercent } from "@/lib/format";
import { Card } from "@/ui";

interface GpsComparisonCardProps {
  /** Distance derived from the start and end readings (domain rule 4). */
  odometerDistance: number;
  /** GPS distance in the vehicle unit; null without a measurable route. */
  gpsDistance: number | null;
  unit: string;
  className?: string | undefined;
}

/** GPS versus odometer distance, with the difference flagged against the tolerance. */
export function GpsComparisonCard({ odometerDistance, gpsDistance, unit, className }: GpsComparisonCardProps) {
  const { t } = useTranslation();
  const comparison = gpsDistance === null ? null : compareGpsWithOdometer(odometerDistance, gpsDistance);
  const Icon = comparison?.withinMargin ? CircleCheck : TriangleAlert;

  return (
    <Card padding="none" className={cn("flex flex-col", className)}>
      <Row label={t("trips.gps")} value={gpsDistance === null ? "—" : formatDistance(gpsDistance, unit)} />
      <Row label={t("trips.odometer")} value={formatDistance(odometerDistance, unit)} />
      <div className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span className="text-body text-muted">{t("trips.difference")}</span>
        {comparison === null ? (
          <span className="ml-auto text-body font-medium text-muted">—</span>
        ) : (
          <span
            className={cn(
              "ml-auto flex items-center gap-1.5 text-right text-body font-semibold",
              comparison.withinMargin ? "text-lime-text" : "text-amber-text",
            )}
          >
            <Icon className="size-4.5 shrink-0" strokeWidth={2.2} aria-hidden />
            {t(comparison.withinMargin ? "trips.withinMargin" : "trips.outOfMargin", {
              value: formatDistance(comparison.difference, unit),
              percent: formatPercent(comparison.ratio),
            })}
          </span>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-3">
      <span className="text-body text-muted">{label}</span>
      <span className="ml-auto font-display text-body font-semibold">{value}</span>
    </div>
  );
}
