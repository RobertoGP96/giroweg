"use client";

import { compareGpsWithOdometer } from "@giroweg/shared/domain";
import { Check, ChevronRight, SquarePlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { nowIso } from "@/lib/id";
import { formatDistance, formatElapsed, formatNumber, formatOdometer, formatOdometerDial, formatPercent } from "@/lib/format";
import { OdometerInput } from "@/features/readings/components/OdometerInput";
import { ReadingRejectedError, readingsRepository } from "@/features/readings/repository";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Button, Card, Figure, OdometerFrame, ProgressBar, Screen, Spacer, Stat, StatusPill, TopBar } from "@/ui";
import { tripsRepository } from "../repository";
import { useShiftStore } from "../store";

export function ShiftEndScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const active = useActiveVehicle();
  const shift = useShiftStore();
  /** Manual correction of the suggested final odometer; null = not edited. */
  const [edit, setEdit] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicle = active.data?.vehicle;
  const unit = vehicle?.unit ?? "km";
  const startValue = shift.startValue ?? 0;

  useEffect(() => {
    if (shift.step === "idle") router.replace("/home");
  }, [shift.step, router]);

  // Suggested final odometer = start + GPS distance; the driver confirms or edits it.
  const suggested = Math.round(startValue + shift.gpsDistance);
  const value = edit === undefined ? suggested : edit;
  const setValue = (next: number | null) => {
    setEdit(next);
    setError(null);
  };

  const odometerKm = value !== null ? Math.max(value - startValue, 0) : 0;
  const gps = compareGpsWithOdometer(odometerKm, shift.gpsDistance);
  const share = odometerKm > 0 ? Math.min(shift.gpsDistance / odometerKm, 1) : 0;

  const save = async () => {
    if (!vehicle || value === null || !shift.startReadingId || !shift.startedAt) return;
    setSaving(true);
    setError(null);
    try {
      const endedAt = nowIso();
      const reading = await readingsRepository.add({
        vehicleId: vehicle.id,
        value,
        recordedAt: endedAt,
        source: "manual",
        note: null,
      });
      await tripsRepository.add({
        vehicleId: vehicle.id,
        startReadingId: shift.startReadingId,
        endReadingId: reading.id,
        startedAt: shift.startedAt,
        endedAt,
        gpsDistance: Number(shift.gpsDistance.toFixed(1)),
        stops: shift.stops,
        pauses: shift.pauses,
        pausedSeconds: shift.pausedSeconds,
        reason: null,
      });
      shift.reset();
      router.push("/home");
    } catch (cause) {
      if (cause instanceof ReadingRejectedError && cause.validation.reason === "below_previous") {
        setError(t("shift.invalidBelow", { value: formatOdometer(cause.validation.previous.value) }));
      } else {
        setError(t("states.errorTitle"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="gap-3 pt-1">
      <TopBar
        title={t("shift.endTitle")}
        onBack={() => {
          shift.backToTrip();
          router.push("/shift/trip");
        }}
        trailing={<span className="text-label text-muted">{t("common.stepOf", { current: 2, total: 2 })}</span>}
      />

      <OdometerFrame
        compact
        dial={formatOdometerDial(value ?? startValue)}
        corner={<StatusPill tone="lime" solid>{t("shift.finalOdometer")}</StatusPill>}
      />

      <OdometerInput value={value} onChange={setValue} label={t("shift.finalOdometer")} tone={error ? "error" : "plain"} />
      {error && (
        <p role="alert" className="text-secondary font-semibold text-amber-text">{error}</p>
      )}

      <Card className="px-5 py-4.5">
        <div className="text-secondary text-muted">{t("shift.kmOfShift")}</div>
        <Figure size="total" value={formatNumber(odometerKm, Number.isInteger(odometerKm) ? 0 : 1)} unit={unit} />
        <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-line pt-3.5">
          <Stat label={t("shift.time")} value={formatElapsed(shift.elapsedSeconds)} />
          <Stat label={t("shift.deliveries")} value={shift.stops} />
          <Stat
            label={t("shift.pauses")}
            value={t("shift.pausesSummary", { count: shift.pauses, minutes: Math.round(shift.pausedSeconds / 60) })}
          />
        </div>
      </Card>

      <Card className="px-5 py-4">
        <div className="mb-2.5 flex justify-between text-body">
          <span className="text-muted">{t("shift.gps")}</span>
          <span className="font-display text-row font-semibold">{formatDistance(shift.gpsDistance, unit)}</span>
        </div>
        <div className="mb-3 flex justify-between text-body">
          <span className="text-muted">{t("shift.odometer")}</span>
          <span className="font-display text-row font-semibold">{formatDistance(odometerKm, unit)}</span>
        </div>
        <ProgressBar value={share} urgent={!gps.withinMargin} label={t("shift.difference")} />
        <div className="mt-2.5 flex justify-between text-secondary">
          <span className="text-muted">{t("shift.difference")}</span>
          <span className={`flex items-center gap-1.5 font-semibold ${gps.withinMargin ? "text-lime-text" : "text-amber-text"}`}>
            {gps.withinMargin ? (
              <Check className="size-4" strokeWidth={2.4} aria-hidden />
            ) : (
              <TriangleAlert className="size-4" strokeWidth={2.4} aria-hidden />
            )}
            {t(gps.withinMargin ? "shift.withinMargin" : "shift.outOfMargin", {
              value: formatDistance(gps.difference, unit),
              percent: formatPercent(gps.ratio),
            })}
          </span>
        </div>
      </Card>

      <Link href="/expenses" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime">
        <Card className="flex items-center gap-3 px-4 py-3 text-body">
          <SquarePlus className="size-5.5 text-muted" strokeWidth={2} aria-hidden />
          <span className="flex-1 text-muted">{t("shift.addNoteOrExpense")}</span>
          <ChevronRight className="size-5 text-muted" strokeWidth={2} aria-hidden />
        </Card>
      </Link>

      <Spacer />
      <Button size="lg" isDisabled={value === null || saving} isPending={saving} onPress={save}>
        {t("shift.saveAndClose")}
      </Button>
    </Screen>
  );
}
