"use client";

import { Ban, Gauge, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatOdometer, formatOdometerDistance, formatShortDate, formatTime } from "@/lib/format";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { Card } from "@/ui";
import type { ReadingEntry } from "../repository";

interface ReadingRowProps {
  entry: ReadingEntry;
  unit: string;
  /** Show the date instead of just the time (lists not grouped by day). */
  withDate?: boolean;
}

export function ReadingRow({ entry, unit, withDate = false }: ReadingRowProps) {
  const { t } = useTranslation();
  const { reading, delta } = entry;
  const sync = useRecordSync(reading.id);
  const voided = reading.voidedAt !== null;
  const Icon = voided ? Ban : reading.odometerReset ? RotateCcw : Gauge;
  const when = withDate ? `${formatShortDate(reading.recordedAt)} · ${formatTime(reading.recordedAt)}` : formatTime(reading.recordedAt);

  return (
    <Link href={`/readings/${reading.id}`} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime">
      <Card className="flex items-center gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2", voided ? "text-amber-text" : "text-muted")}>
          <Icon className="size-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("font-display text-button font-semibold", voided && "text-muted line-through")}>
            {formatOdometer(reading.value)} <span className="text-secondary font-medium text-muted">{unit}</span>
          </div>
          <div className="truncate text-label text-muted">
            {when} · {t(`readings.sources.${reading.source}`)}
            {reading.odometerReset && ` · ${t("readings.odometerReset")}`}
            {voided && ` · ${t("readings.voided")}`}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {delta !== null && (
            <span className="font-display text-body font-semibold text-lime-text">+{formatOdometerDistance(delta, unit)}</span>
          )}
          <SyncBadge state={sync} />
        </div>
      </Card>
    </Link>
  );
}
