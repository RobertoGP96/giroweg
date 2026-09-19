"use client";

import { Bell, Disc, Plus, Wrench, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDistance, formatOdometer } from "@/lib/format";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Button, Card, ErrorState, ListSkeleton, ProgressBar, Screen, StatusPill, TopBar } from "@/ui";
import { useMaintenance } from "../hooks/useMaintenance";
import { maintenanceRepository, type MaintenanceItem } from "../repository";

const ICONS: Record<string, typeof Wrench> = { oil: Wrench, rearTyre: Disc, brakePads: Zap };

export function MaintenanceScreen() {
  const { t } = useTranslation();
  const active = useActiveVehicle();
  const vehicle = active.data?.vehicle;
  const maintenance = useMaintenance(vehicle?.id);
  const unit = vehicle?.unit ?? "km";
  const loading = active.status === "loading" || maintenance.status === "loading";
  const failed = active.status === "error" || maintenance.status === "error";
  const items = maintenance.data?.items ?? [];
  const upcoming = items.filter((item) => item.progress.urgent).length;

  const markDone = async (item: MaintenanceItem) => {
    if (!maintenance.data) return;
    await maintenanceRepository.markDone(item.rule, maintenance.data.current);
    maintenance.reload();
  };

  return (
    <Screen className="pt-1">
      <TopBar
        title={t("maintenance.title")}
        backHref="/home"
        trailing={
          vehicle?.plate && (
            <span className="rounded-sm bg-surface px-2.5 py-1.5 font-display text-secondary font-semibold tracking-wide">
              {vehicle.plate}
            </span>
          )
        }
      />

      {loading && <ListSkeleton />}
      {failed && <ErrorState onRetry={() => { active.reload(); maintenance.reload(); }} />}

      {!loading && !failed && maintenance.data && (
        <>
          <Card className="px-5 py-4.5">
            <div className="flex items-center justify-between">
              <div className="text-secondary text-muted">{t("maintenance.currentOdometer")}</div>
              {upcoming > 0 && <StatusPill tone="amber">{t("maintenance.upcoming", { count: upcoming })}</StatusPill>}
            </div>
            <div className="font-display text-odometer font-bold leading-tight">
              {formatOdometer(maintenance.data.current)}{" "}
              <span className="text-body-lg font-semibold text-muted">{unit}</span>
            </div>
          </Card>

          {items.map((item) => {
            const Icon = ICONS[item.rule.name] ?? Wrench;
            const urgent = item.progress.urgent;
            const remaining = item.progress.remaining;
            return (
              <Card key={item.rule.id} tone={urgent ? "alert" : "default"} padding="lg" className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("size-5.5", urgent ? "text-amber-text" : "text-muted")} strokeWidth={2} aria-hidden />
                    <span className="text-row font-semibold">{t(`maintenance.services.${item.rule.name}`)}</span>
                  </div>
                  <span className={cn("font-display text-row font-semibold", urgent && "text-amber-text")}>
                    {remaining >= 0
                      ? t("maintenance.inDistance", { distance: formatDistance(remaining, unit, 0) })
                      : t("maintenance.overdue", { distance: formatDistance(-remaining, unit, 0) })}
                  </span>
                </div>
                <ProgressBar value={item.progress.progress} urgent={urgent} label={t(`maintenance.services.${item.rule.name}`)} />
                <div className="flex justify-between text-label text-muted">
                  <span>{t("maintenance.last", { value: formatDistance(item.lastValue, unit, 0) })}</span>
                  <span>{t("maintenance.next", { value: formatDistance(item.nextValue, unit, 0) })}</span>
                </div>
                {urgent && (
                  <Button variant="secondary" size="md" className="h-11 rounded-md text-body" onPress={() => void markDone(item)}>
                    {t("maintenance.markDone")}
                  </Button>
                )}
              </Card>
            );
          })}

          <div className="flex items-center gap-2.5 p-1 text-secondary text-muted">
            <Bell className="size-4.5" strokeWidth={2} aria-hidden />
            {t("maintenance.reminder", { distance: formatDistance(items[0]?.rule.remindUnitsBefore ?? 300, unit, 0) })}
          </div>
        </>
      )}

      <div className="flex-1" aria-hidden />
      <Button variant="outline" size="md" className="mb-4 text-body-lg">
        <Plus className="size-4.5" strokeWidth={2} aria-hidden />
        {t("maintenance.addService")}
      </Button>
    </Screen>
  );
}
