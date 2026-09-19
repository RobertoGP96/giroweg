"use client";

import { Download, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime, formatOdometer, formatShortDate } from "@/lib/format";
import { ReadingRow } from "@/features/readings/components/ReadingRow";
import { exportReadingsCsv } from "@/features/readings/export";
import { useVehicleStats } from "@/features/readings/hooks/useReadings";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { AlertCard, Button, Card, ErrorState, Figure, IconButton, ListSkeleton, Screen, SectionLabel, Spacer, TopBar } from "@/ui";
import { VehicleChart } from "../components/VehicleChart";
import { VehicleTypeIcon } from "../components/VehicleTypeIcon";
import { useVehicle } from "../hooks/useVehicles";
import { selectVehicle } from "../repository";

const RECENT_COUNT = 5;

export function VehicleDetailScreen({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const detail = useVehicle(vehicleId);
  const stats = useVehicleStats(vehicleId);
  const sync = useRecordSync(vehicleId);

  useEffect(() => {
    router.prefetch("/readings/new");
  }, [router]);

  if (detail.status === "loading") {
    return (
      <Screen className="pt-1">
        <TopBar title="" backHref="/vehicles" />
        <ListSkeleton />
      </Screen>
    );
  }
  if (detail.status === "error") {
    return (
      <Screen className="pt-1">
        <TopBar title="" backHref="/vehicles" />
        <ErrorState onRetry={detail.reload} />
      </Screen>
    );
  }

  const { vehicle, odometer, lastReading, entries } = detail.data;
  const unit = vehicle.unit;
  const details = [vehicle.brand, vehicle.model, vehicle.year].filter((part) => part !== null).join(" · ");
  const archived = vehicle.archivedAt !== null;

  const newReading = () => {
    selectVehicle(vehicle.id);
    router.push(`/readings/new?vehicle=${vehicle.id}`);
  };

  return (
    <Screen className="pt-1">
      <TopBar
        title={vehicle.name}
        backHref="/vehicles"
        trailing={
          <IconButton label={t("vehicles.edit")} tone="elevated" className="size-11" onPress={() => router.push(`/vehicles/${vehicle.id}/edit`)}>
            <Pencil className="size-5" strokeWidth={2} />
          </IconButton>
        }
      />

      {archived && vehicle.archivedAt && (
        <AlertCard title={t("vehicles.archivedTitle")} body={t("vehicles.archivedBody", { date: formatShortDate(vehicle.archivedAt) })} />
      )}

      <div className="flex items-center gap-3.5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
          <VehicleTypeIcon type={vehicle.type} className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-body text-muted">
            {t(`vehicles.types.${vehicle.type}`)}
            {vehicle.plate && (
              <>
                {" · "}
                <span className="font-display font-semibold tracking-wide text-text">{vehicle.plate}</span>
              </>
            )}
          </div>
          <div className="truncate text-secondary text-muted">{details || t("vehicles.noDetails")}</div>
        </div>
        <SyncBadge state={sync} showLabel />
      </div>

      <Card padding="lg">
        <div className="text-secondary text-muted">{t("home.currentOdometer")}</div>
        <Figure size="total" value={formatOdometer(odometer)} unit={unit} className="mt-1" />
        <div className="mt-2 text-secondary text-muted">
          {lastReading ? t("home.lastReadingAt", { date: formatDateTime(lastReading.recordedAt) }) : t("home.noReadingsYet")}
        </div>
      </Card>

      {stats.data && stats.data.days.length > 0 && (
        <VehicleChart days={stats.data.days} weekDistance={stats.data.weekDistance} monthDistance={stats.data.monthDistance} unit={unit} />
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <SectionLabel>{t("readings.title")}</SectionLabel>
          {entries.length > RECENT_COUNT && (
            <Link href={`/history?vehicle=${vehicle.id}`} className="text-secondary font-semibold text-lime-text outline-none focus-visible:ring-2 focus-visible:ring-lime rounded-sm">
              {t("home.seeAll")}
            </Link>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="text-body text-muted">{t("states.emptyReadingsBody")}</p>
        ) : (
          entries.slice(0, RECENT_COUNT).map((entry) => <ReadingRow key={entry.reading.id} entry={entry} unit={unit} withDate />)
        )}
      </section>

      <Spacer />
      {entries.length > 0 && (
        <Button variant="outline" size="md" className="text-body-lg" onPress={() => exportReadingsCsv(vehicle, entries)}>
          <Download className="size-5" strokeWidth={2} aria-hidden />
          {t("readings.exportCsv")}
        </Button>
      )}
      {!archived && (
        <Button size="lg" onPress={newReading}>
          <Plus className="size-5.5" strokeWidth={2.4} aria-hidden />
          {t("readings.new")}
        </Button>
      )}
    </Screen>
  );
}
