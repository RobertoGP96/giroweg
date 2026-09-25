"use client";

import { Avatar } from "@heroui/react";
import { Car, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSessionUser } from "@/auth/useSessionUser";
import { formatDateTime, formatOdometer } from "@/lib/format";
import { ReadingRow } from "@/features/readings/components/ReadingRow";
import { useReadings, useVehicleStats } from "@/features/readings/hooks/useReadings";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { SyncQueueCard } from "@/features/sync/components/SyncQueueCard";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { recordSyncState } from "@/features/sync/hooks/useRecordSync";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { primeVehicleDetail, useSelectedVehicle, useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { selectVehicle } from "@/features/vehicles/repository";
import { Button, Card, EmptyState, ErrorState, Figure, FilterChip, ListSkeleton, OfflineBanner, Screen, SectionLabel, SharedElement, Spacer, navOptions, useNavigate } from "@/ui";

const RECENT_COUNT = 3;

export function HomeScreen() {
  const { t } = useTranslation();
  const { push, prefetch, pending } = useNavigate();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const { user } = useSessionUser();
  const vehicles = useVehicles("active");
  const selected = useSelectedVehicle(vehicles.data);
  const stats = useVehicleStats(selected?.vehicle.id);
  const readings = useReadings(selected?.vehicle.id);

  // The primary actions must feel instant: preload their screens.
  useEffect(() => {
    prefetch("/readings/new");
    prefetch("/vehicles/new");
  }, [prefetch]);

  const empty = vehicles.status === "success" && vehicles.data.length === 0;
  const unit = selected?.vehicle.unit ?? "km";
  const recent = (readings.data ?? []).slice(0, RECENT_COUNT);

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen>
        <header className="flex min-h-14 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-secondary text-muted">{user ? t("home.greeting", { name: user.firstName }) : " "}</div>
            <div className="truncate font-display text-card-title font-semibold">
              {selected ? `${selected.vehicle.name}${selected.vehicle.plate ? ` · ${selected.vehicle.plate}` : ""}` : t("app.tagline")}
            </div>
          </div>
          <Link href="/profile" {...navOptions("tab")} aria-label={t("home.profileOf", { name: user?.name ?? "" })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime">
            <Avatar size="md" className="size-11 bg-surface-2 font-display text-row font-semibold text-text">
              <Avatar.Fallback>{user?.initials ?? "·"}</Avatar.Fallback>
            </Avatar>
          </Link>
        </header>

        {vehicles.status === "loading" && <ListSkeleton />}
        {vehicles.status === "error" && <ErrorState onRetry={vehicles.reload} />}
        {empty && (
          <EmptyState
            icon={<Car className="size-13" strokeWidth={1.8} aria-hidden />}
            title={t("home.emptyTitle")}
            body={t("home.emptyBody")}
            action={
              <Button size="lg" onPress={() => push("/vehicles/new")} isPending={pending} className="mt-2">
                <Plus className="size-5" strokeWidth={2.4} aria-hidden />
                {t("vehicles.add")}
              </Button>
            }
          />
        )}

        {selected && vehicles.data && (
          <>
            {vehicles.data.length > 1 && (
              <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-0.5">
                {vehicles.data.map((summary) => (
                  <FilterChip
                    key={summary.vehicle.id}
                    selected={summary.vehicle.id === selected.vehicle.id}
                    onClick={() => selectVehicle(summary.vehicle.id)}
                  >
                    {summary.vehicle.name}
                  </FilterChip>
                ))}
              </div>
            )}

            <Link
              href={`/vehicles/${selected.vehicle.id}`}
              {...navOptions("forward")}
              onPointerDown={() => primeVehicleDetail(selected.vehicle.id)}
              onFocus={() => primeVehicleDetail(selected.vehicle.id)}
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <Card padding="lg">
                <div className="flex items-center justify-between gap-3 text-secondary text-muted">
                  <span>
                    {t("home.currentOdometer")}
                    {!online && <span className="text-amber-text"> · {t("common.local")}</span>}
                  </span>
                  <SyncBadge state={recordSyncState(queue, selected.vehicle.id)} showLabel />
                </div>
                <SharedElement name={`odometer-${selected.vehicle.id}`}>
                  <Figure size="display" value={formatOdometer(selected.odometer)} unit={unit} className="mt-1.5" />
                </SharedElement>
                <div className="mt-3 text-secondary text-muted">
                  {selected.lastReading
                    ? t("home.lastReadingAt", { date: formatDateTime(selected.lastReading.recordedAt) })
                    : t("home.noReadingsYet")}
                </div>
              </Card>
            </Link>

            <div className="grid grid-cols-2 gap-2.5">
              <Card padding="none" className="px-4 py-3">
                <div className="text-label text-muted">{t("home.monthDistance")}</div>
                <div className="font-display text-stat font-semibold">
                  {formatOdometer(stats.data?.monthDistance ?? 0)} <span className="text-secondary text-muted">{unit}</span>
                </div>
              </Card>
              <Card padding="none" className="px-4 py-3">
                <div className="text-label text-muted">{t("home.monthReadings")}</div>
                <div className="font-display text-stat font-semibold">{stats.data?.monthReadings ?? 0}</div>
              </Card>
            </div>

            {recent.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <SectionLabel>{t("home.recentReadings")}</SectionLabel>
                  <Link
                    href={`/history?vehicle=${selected.vehicle.id}`}
                    {...navOptions("tab")}
                    className="rounded-sm text-secondary font-semibold text-lime-text outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  >
                    {t("home.seeAll")}
                  </Link>
                </div>
                {recent.map((entry) => (
                  <ReadingRow key={entry.reading.id} entry={entry} unit={unit} withDate />
                ))}
              </section>
            )}

            {!online && <SyncQueueCard entries={queue} online={online} />}

            <Spacer />
            <Button size="lg" className="mb-1" isPending={pending} onPress={() => push(`/readings/new?vehicle=${selected.vehicle.id}`)}>
              <Plus className="size-5.5" strokeWidth={2.4} aria-hidden />
              {t("readings.new")}
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
