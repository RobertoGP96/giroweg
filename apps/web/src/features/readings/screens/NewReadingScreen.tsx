"use client";

import { odometerAt } from "@giroweg/shared/domain";
import { Car, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ZodError } from "zod";
import { useLocalSession } from "@/db/hooks";
import { formatOdometerDistance, fromDateTimeLocal, nowLocalDateTime } from "@/lib/format";
import { VehicleTypeIcon } from "@/features/vehicles/components/VehicleTypeIcon";
import { useSelectedVehicle, useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { selectVehicle } from "@/features/vehicles/repository";
import { Button, Card, EmptyState, ErrorState, FilterChip, ListSkeleton, Screen, Spacer, TextArea, TextInput, Toggle, TopBar } from "@/ui";
import { OdometerInput } from "../components/OdometerInput";
import { useReadings } from "../hooks/useReadings";
import { ReadingRejectedError, readingsRepository } from "../repository";

/** Readings may be backdated, never dated in the future (small clock skew allowed). */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export function NewReadingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const session = useLocalSession();
  const vehicles = useVehicles("active");
  const [chosenId, setChosenId] = useState<string | null>(params.get("vehicle"));
  const current = useSelectedVehicle(vehicles.data, chosenId);
  const readings = useReadings(current?.vehicle.id);

  const [value, setValue] = useState<number | null>(null);
  const [recordedAtLocal, setRecordedAtLocal] = useState(() => nowLocalDateTime());
  const [note, setNote] = useState("");
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<{ field: "value" | "date" | "note" | "form"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const unit = current?.vehicle.unit ?? "km";
  const recordedAt = fromDateTimeLocal(recordedAtLocal);
  const existing = (readings.data ?? []).map((entry) => entry.reading);
  const reference = current && recordedAt ? odometerAt(existing, recordedAt, current.vehicle.initialValue) : (current?.odometer ?? 0);
  const delta = value !== null && !reset ? value - reference : null;

  const save = async () => {
    if (!current || value === null || saving) return;
    setError(null);
    if (!recordedAt) return setError({ field: "date", text: t("readings.errors.invalidDate") });
    if (new Date(recordedAt).getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      return setError({ field: "date", text: t("readings.errors.future") });
    }
    setSaving(true);
    try {
      await readingsRepository.add({
        vehicleId: current.vehicle.id,
        value,
        recordedAt,
        source: "manual",
        note: note.trim() === "" ? null : note.trim(),
        odometerReset: reset,
      });
      selectVehicle(current.vehicle.id);
      router.replace("/home");
    } catch (cause) {
      if (cause instanceof ReadingRejectedError) {
        const v = cause.validation;
        if (v.reason === "below_previous") {
          setError({ field: "value", text: t("readings.errors.invalidBelow", { value: formatOdometerDistance(v.previous.value, unit) }) });
        } else if (v.reason === "above_next") {
          setError({ field: "value", text: t("readings.errors.invalidAbove", { value: formatOdometerDistance(v.next.value, unit) }) });
        } else {
          setError({ field: "value", text: t("readings.errors.save") });
        }
      } else if (cause instanceof ZodError) {
        setError({ field: "note", text: t("readings.errors.resetNeedsNote") });
      } else if (cause instanceof Error && cause.name === "NoSessionError") {
        setError({ field: "form", text: t("readings.errors.noSession") });
      } else {
        setError({ field: "form", text: t("readings.errors.save") });
      }
    } finally {
      setSaving(false);
    }
  };

  const noVehicles = vehicles.status === "success" && vehicles.data.length === 0;

  return (
    <Screen className="pt-1">
      <TopBar title={t("readings.newTitle")} backHref="/home" />

      {vehicles.status === "loading" && <ListSkeleton />}
      {vehicles.status === "error" && <ErrorState onRetry={vehicles.reload} />}
      {noVehicles && (
        <EmptyState
          icon={<Car className="size-13" strokeWidth={1.8} aria-hidden />}
          title={t("vehicles.emptyTitle")}
          body={t("vehicles.emptyBody")}
          action={
            <Button size="lg" onPress={() => router.push("/vehicles/new")} className="mt-2">
              <Plus className="size-5" strokeWidth={2.4} aria-hidden />
              {t("vehicles.add")}
            </Button>
          }
        />
      )}

      {current && vehicles.data && (
        <>
          {vehicles.data.length > 1 && (
            <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-0.5">
              {vehicles.data.map((summary) => (
                <FilterChip
                  key={summary.vehicle.id}
                  selected={summary.vehicle.id === current.vehicle.id}
                  onClick={() => {
                    setChosenId(summary.vehicle.id);
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

          <p className="text-secondary text-muted">{t("readings.enterValue")}</p>
          <OdometerInput
            value={value}
            onChange={(next) => {
              setValue(next);
              if (error?.field === "value") setError(null);
            }}
            label={t("readings.value")}
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
              {delta !== null && delta >= 0 && (
                <span className="font-semibold text-lime-text">{t("readings.delta", { value: formatOdometerDistance(delta, unit) })}</span>
              )}
            </div>
          )}

          <TextInput
            type="datetime-local"
            label={t("readings.recordedAt")}
            value={recordedAtLocal}
            max={nowLocalDateTime()}
            onChange={(event) => {
              setRecordedAtLocal(event.target.value);
              if (error?.field === "date") setError(null);
            }}
            error={error?.field === "date" ? error.text : undefined}
          />

          <TextArea
            label={reset ? t("readings.note") : `${t("readings.note")} · ${t("common.optional")}`}
            value={note}
            placeholder={reset ? t("readings.resetNoteHint") : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              if (error?.field === "note") setError(null);
            }}
            error={error?.field === "note" ? error.text : undefined}
          />

          <Card className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold">{t("readings.odometerReset")}</div>
              <div className="text-label leading-relaxed text-muted">{t("readings.odometerResetHint")}</div>
            </div>
            <Toggle label={t("readings.odometerReset")} isSelected={reset} onChange={setReset} />
          </Card>

          {error?.field === "form" && (
            <p role="alert" className="text-secondary font-semibold text-amber-text">
              {error.text}
            </p>
          )}

          <Spacer />
          <Button
            size="lg"
            isDisabled={value === null || saving || !session || (reset && note.trim() === "")}
            isPending={saving}
            onPress={() => void save()}
          >
            {t("readings.save")}
          </Button>
        </>
      )}
    </Screen>
  );
}
