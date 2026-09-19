"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { nowIso } from "@/lib/id";
import { formatDistance, formatOdometer, formatOdometerDial } from "@/lib/format";
import { OdometerInput } from "@/features/readings/components/OdometerInput";
import { ReadingRejectedError, readingsRepository } from "@/features/readings/repository";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { AlertCard, Button, ErrorState, ListSkeleton, OdometerFrame, Screen, Spacer, StatusPill, TopBar } from "@/ui";
import { useShiftStore } from "../store";

type OcrResult = { status: "detected"; value: number; confidence: number } | { status: "failed" };

/**
 * Placeholder for the on-device OCR: suggests the last known value plus a
 * few units. Alternates with a failed read on retake so both states of the
 * screen can be exercised. Replaced by ML Kit on the mobile build.
 */
const fakeOcr = (lastValue: number, attempt: number): OcrResult =>
  attempt % 2 === 1
    ? { status: "failed" }
    : { status: "detected", value: Math.ceil(lastValue) + 9, confidence: 98 };

export function ShiftStartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const active = useActiveVehicle();
  const step = useShiftStore((s) => s.step);
  const beginStart = useShiftStore((s) => s.beginStart);
  const confirmStart = useShiftStore((s) => s.confirmStart);
  const [attempt, setAttempt] = useState(0);
  /** What the driver typed for the current capture; null = no edit yet. */
  const [edit, setEdit] = useState<{ attempt: number; value: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicle = active.data?.vehicle;
  const lastValue = active.data?.odometer ?? 0;
  const ocr = useMemo(() => fakeOcr(lastValue, attempt), [lastValue, attempt]);

  // The OCR value is only a suggestion: the editable field starts from it
  // and any manual edit for this capture wins.
  const suggested = ocr.status === "detected" ? ocr.value : null;
  const value = edit?.attempt === attempt ? edit.value : suggested;
  const setValue = (next: number | null) => {
    setEdit({ attempt, value: next });
    setError(null);
  };

  // Entering the screen directly (deep link / reload) still starts a shift.
  useEffect(() => {
    if (vehicle && step === "idle") beginStart(vehicle.id);
  }, [vehicle, step, beginStart]);

  const retake = () => {
    setAttempt((a) => a + 1);
    setError(null);
  };

  const confirm = async () => {
    if (!vehicle || value === null) return;
    setSaving(true);
    setError(null);
    try {
      const recordedAt = nowIso();
      const reading = await readingsRepository.add({
        vehicleId: vehicle.id,
        value,
        recordedAt,
        source: ocr.status === "detected" && value === ocr.value ? "ocr" : "manual",
        note: null,
      });
      confirmStart({ startValue: reading.value, startReadingId: reading.id, startedAt: recordedAt });
      router.push("/shift/trip");
    } catch (cause) {
      if (cause instanceof ReadingRejectedError) {
        const v = cause.validation;
        if (v.reason === "below_previous") setError(t("shift.invalidBelow", { value: formatOdometer(v.previous.value) }));
        else if (v.reason === "above_next") setError(t("shift.invalidAbove", { value: formatOdometer(v.next.value) }));
        else setError(t("states.errorTitle"));
      } else {
        setError(t("states.errorTitle"));
      }
    } finally {
      setSaving(false);
    }
  };

  const delta = value !== null ? value - lastValue : 0;
  const unit = vehicle?.unit ?? "km";

  return (
    <Screen className="pt-1">
      <TopBar
        title={t("shift.startTitle")}
        backHref="/home"
        trailing={<span className="text-label text-muted">{t("common.stepOf", { current: 1, total: 2 })}</span>}
      />

      {active.status === "loading" && <ListSkeleton />}
      {active.status === "error" && <ErrorState onRetry={active.reload} />}

      {active.status === "success" && (
        <>
          <OdometerFrame
            dial={ocr.status === "detected" ? formatOdometerDial(ocr.value) : `${formatOdometerDial(lastValue).slice(0, 5)}?`}
            failed={ocr.status === "failed"}
            badge={
              ocr.status === "detected" ? (
                <StatusPill tone="lime" solid>{t("shift.readingDetected", { confidence: ocr.confidence })}</StatusPill>
              ) : (
                <StatusPill tone="amber" solid>{t("shift.readingFailed")}</StatusPill>
              )
            }
          />

          {ocr.status === "failed" ? (
            <AlertCard
              emphasized
              title={t("shift.readingFailedTitle")}
              body={t("shift.readingFailedBody", { value: formatDistance(lastValue, unit, 0) })}
            />
          ) : (
            <p className="text-secondary text-muted">{t("shift.confirmReading")}</p>
          )}

          <OdometerInput
            value={value}
            onChange={setValue}
            label={t("shift.startTitle")}
            tone={error ? "error" : ocr.status === "failed" ? "plain" : "focused"}
            hint={ocr.status === "failed" && value === null ? t("shift.typeManually") : undefined}
          />

          {error ? (
            <p role="alert" className="text-secondary font-semibold text-amber-text">{error}</p>
          ) : (
            <div className="flex justify-between text-secondary text-muted">
              <span>{t("shift.lastReading", { value: formatDistance(lastValue, unit, 0) })}</span>
              {value !== null && delta >= 0 && (
                <span className="font-semibold text-lime-text">{t("shift.delta", { value: formatDistance(delta, unit, 0) })}</span>
              )}
            </div>
          )}

          <Spacer />

          {ocr.status === "failed" ? (
            <>
              <Button size="lg" onPress={retake}>
                <Camera className="size-5" strokeWidth={2.4} aria-hidden />
                {t("shift.retakePhoto")}
              </Button>
              <Button variant="ghost" size="md" isDisabled={value === null || saving} onPress={confirm}>
                {t("shift.continueManual")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="md" onPress={retake} className="text-body-lg">
                <Camera className="size-5" strokeWidth={2} aria-hidden />
                {t("shift.retakePhoto")}
              </Button>
              <Button size="lg" isDisabled={value === null || saving} isPending={saving} onPress={confirm}>
                {t("shift.confirmAndStart")}
              </Button>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
