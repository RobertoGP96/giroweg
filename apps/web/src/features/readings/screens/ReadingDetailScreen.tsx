"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTime, formatOdometer, formatOdometerDistance } from "@/lib/format";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { AlertCard, Button, Card, ErrorState, Figure, ListSkeleton, Screen, Spacer, TextArea, TopBar, useNavigate } from "@/ui";
import { useReading } from "../hooks/useReadings";
import { readingsRepository } from "../repository";

const MIN_REASON_LENGTH = 3;

export function ReadingDetailScreen({ readingId }: { readingId: string }) {
  const { t } = useTranslation();
  const { back, pending } = useNavigate();
  const detail = useReading(readingId);
  const sync = useRecordSync(readingId);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (detail.status === "loading") {
    return (
      <Screen className="pt-1">
        <TopBar title={t("readings.detailTitle")} backHref="/history" />
        <ListSkeleton />
      </Screen>
    );
  }
  if (detail.status === "error") {
    return (
      <Screen className="pt-1">
        <TopBar title={t("readings.detailTitle")} backHref="/history" />
        <ErrorState onRetry={detail.reload} />
      </Screen>
    );
  }

  const { reading, vehicle, delta } = detail.data;
  const unit = vehicle?.unit ?? "km";
  const voided = reading.voidedAt !== null;
  const backHref = `/history?vehicle=${reading.vehicleId}`;

  const confirmVoid = async () => {
    setSaving(true);
    setError(null);
    try {
      await readingsRepository.void(reading.id, reason.trim());
      setConfirming(false);
      setReason("");
    } catch {
      setError(t("readings.errors.void"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="pt-1">
      <TopBar title={t("readings.detailTitle")} backHref={backHref} />

      {voided && reading.voidedAt && (
        <AlertCard emphasized title={t("readings.voidedTitle", { date: formatDateTime(reading.voidedAt) })} body={reading.voidReason ?? ""} />
      )}

      <Card padding="lg">
        <div className="text-secondary text-muted">{vehicle?.name ?? t("readings.title")}</div>
        <Figure
          size="total"
          value={formatOdometer(reading.value)}
          unit={unit}
          tone={voided ? "muted" : "text"}
          className={cn("mt-1", voided && "line-through")}
        />
        {delta !== null && (
          <div className="mt-1 font-display text-body font-semibold text-lime-text">
            {t("readings.delta", { value: formatOdometerDistance(delta, unit) })}
          </div>
        )}
      </Card>

      <Card padding="none" className="flex flex-col">
        <DetailRow label={t("readings.recordedAt")} value={formatDateTime(reading.recordedAt)} />
        <DetailRow label={t("readings.source")} value={t(`readings.sources.${reading.source}`)} />
        {reading.odometerReset && <DetailRow label={t("readings.odometerReset")} value={t("common.yes")} />}
        {reading.note && <DetailRow label={t("readings.note")} value={reading.note} />}
        <DetailRow label={t("sync.state.label")} value={<SyncBadge state={sync} showLabel />} last />
      </Card>

      <Spacer />

      {!voided &&
        (confirming ? (
          <Card tone="alert" className="flex flex-col gap-3">
            <div className="text-body font-semibold">{t("readings.voidTitle")}</div>
            <p className="text-secondary leading-relaxed text-muted">{t("readings.voidBody")}</p>
            <TextArea
              label={t("readings.voidReason")}
              value={reason}
              autoFocus
              onChange={(event) => setReason(event.target.value)}
              error={error ?? undefined}
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onPress={() => setConfirming(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="md"
                className="flex-1 bg-surface-2"
                isDisabled={reason.trim().length < MIN_REASON_LENGTH || saving}
                isPending={saving}
                onPress={() => void confirmVoid()}
              >
                {t("readings.voidConfirm")}
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="destructive" size="md" onPress={() => setConfirming(true)}>
            {t("readings.void")}
          </Button>
        ))}
      {voided && (
        <Button variant="outline" size="md" isPending={pending} onPress={() => back(backHref)}>
          {t("common.back")}
        </Button>
      )}
    </Screen>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 px-4 py-3", !last && "border-b border-line")}>
      <span className="text-body text-muted">{label}</span>
      <span className="ml-auto text-right text-body font-medium">{value}</span>
    </div>
  );
}
