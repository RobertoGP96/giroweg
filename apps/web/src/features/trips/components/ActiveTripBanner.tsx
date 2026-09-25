"use client";

import { metersToUnit } from "@giroweg/shared/domain";
import { ChevronRight, Navigation } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { formatDistance, formatElapsed } from "@/lib/format";
import { Card, navOptions } from "@/ui";
import { useActiveTrip } from "../hooks/useActiveTrip";

/** Card on the home screen while a trip is being recorded on this device. */
export function ActiveTripBanner() {
  const { t } = useTranslation();
  const { tracking, elapsed } = useActiveTrip();
  if (tracking === null) return null;

  const distance = formatDistance(metersToUnit(tracking.distanceMeters, tracking.unit), tracking.unit);

  return (
    <Link
      href="/trips/active"
      {...navOptions("forward")}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <Card tone="selected" className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-lime text-ink">
          <Navigation className="size-5" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">
            {t("trips.inProgress")}
            {tracking.status === "paused" && <span className="text-muted"> · {t("trips.paused")}</span>}
          </div>
          <div className="font-display text-secondary font-semibold text-lime-text">
            {distance} · {formatElapsed(elapsed)}
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      </Card>
    </Link>
  );
}
