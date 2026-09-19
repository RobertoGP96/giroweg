"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatOdometer, formatOdometerDistance, formatWeekdayLetter } from "@/lib/format";
import type { DayDistance } from "@/features/readings/repository";
import { Card } from "@/ui";

interface VehicleChartProps {
  days: DayDistance[];
  weekDistance: number;
  monthDistance: number;
  unit: string;
}

/** Distance per day over the last seven days, derived from the readings. */
export function VehicleChart({ days, weekDistance, monthDistance, unit }: VehicleChartProps) {
  const { t } = useTranslation();
  const max = Math.max(...days.map((day) => day.distance), 1);

  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-secondary text-muted">{t("vehicles.chart.last7Days")}</div>
        <div className="font-display text-secondary font-semibold text-muted">
          {t("vehicles.chart.month", { value: formatOdometerDistance(monthDistance, unit) })}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2 font-display">
        <span className="text-odometer font-bold leading-tight">{formatOdometer(weekDistance)}</span>
        <span className="text-body-lg font-semibold text-muted">{unit}</span>
      </div>
      <div className="mt-3 flex h-14 items-end gap-1.5" role="img" aria-label={t("vehicles.chart.label")}>
        {days.map((day) => (
          <div
            key={day.date}
            className={cn("flex-1 rounded-bar", day.isToday ? "bg-lime" : "bg-track")}
            style={{ height: `${Math.max((day.distance / max) * 100, day.distance > 0 ? 6 : 3)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-nav text-muted" aria-hidden>
        {days.map((day) => (
          <span key={day.date} className="flex-1 text-center">
            {formatWeekdayLetter(day.date)}
          </span>
        ))}
      </div>
    </Card>
  );
}
