"use client";

import { Avatar } from "@heroui/react";
import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSessionUser } from "@/auth/useSessionUser";
import { formatDistance, formatNumber, formatTime } from "@/lib/format";
import { useMaintenance } from "@/features/maintenance/hooks/useMaintenance";
import { SyncQueueCard } from "@/features/sync/components/SyncQueueCard";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { summarizeToday, useTrips } from "@/features/trips/hooks/useTrips";
import { useShiftStore } from "@/features/trips/store";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { AlertCard, Button, Card, ErrorState, Figure, ListSkeleton, OfflineBanner, Screen, Spacer } from "@/ui";

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const { user } = useSessionUser();
  const active = useActiveVehicle();
  const vehicle = active.data?.vehicle;
  const trips = useTrips(vehicle?.id);
  const maintenance = useMaintenance(vehicle?.id);
  const beginStart = useShiftStore((s) => s.beginStart);

  // The primary action must feel instant: preload the shift screens.
  useEffect(() => {
    router.prefetch("/shift/start");
    router.prefetch("/shift/trip");
  }, [router]);

  const startShift = () => {
    if (!vehicle) return;
    beginStart(vehicle.id);
    router.push("/shift/start");
  };

  const loading = active.status === "loading" || trips.status === "loading";
  const failed = active.status === "error" || trips.status === "error";
  const today = trips.data ? summarizeToday(trips.data) : undefined;
  const nextService = maintenance.data?.items[0];
  const pendingCount = queue.length > 0 ? queue.length : 3;

  return (
    <>
      {!online && <OfflineBanner pendingCount={pendingCount} className="mt-2" />}
      <Screen>
        <header className="flex min-h-14 items-center justify-between">
          <div>
            <div className="text-secondary text-muted">{user ? t("home.greeting", { name: user.firstName }) : " "}</div>
            <div className="font-display text-card-title font-semibold">
              {vehicle ? `${vehicle.name} · ${vehicle.plate ?? ""}` : " "}
            </div>
          </div>
          <Link href="/profile" aria-label={t("home.profileOf", { name: user?.name ?? "" })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime">
            <Avatar size="md" className="size-11 bg-surface-2 font-display text-row font-semibold text-text">
              <Avatar.Fallback>{user?.initials ?? "·"}</Avatar.Fallback>
            </Avatar>
          </Link>
        </header>

        {loading && <ListSkeleton />}
        {failed && <ErrorState onRetry={() => { active.reload(); trips.reload(); }} />}

        {!loading && !failed && today && vehicle && (
          <>
            <Card padding="lg">
              <div className="mb-1.5 text-secondary text-muted">
                {t("home.kmToday")}
                {!online && <span className="text-amber-text"> · {t("common.local")}</span>}
              </div>
              <Figure size="display" value={formatNumber(today.distance)} unit={vehicle.unit} />
              <div className="mt-3.5 flex gap-5 text-secondary text-muted">
                <span>
                  <b className="font-display text-text">{today.shifts}</b> {t("home.shiftsLabel", { count: today.shifts })}
                </span>
                <span>
                  <b className="font-display text-text">{today.deliveries}</b> {t("home.deliveriesLabel", { count: today.deliveries })}
                </span>
                <span>
                  <b className="font-display text-text">{formatNumber(today.hours)}</b> {t("common.hours")}
                </span>
              </div>
            </Card>

            {online ? (
              <>
                {today.lastTrip && (
                  <Link href={`/history/${today.lastTrip.trip.id}`} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime">
                    <Card className="flex items-center justify-between px-5 py-4">
                      <div>
                        <div className="text-secondary text-muted">{t("home.lastTrip")}</div>
                        <div className="mt-0.5 font-display text-button font-semibold">{today.lastTrip.trip.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-button font-semibold">{formatDistance(today.lastTrip.distance, vehicle.unit)}</div>
                        <div className="text-label text-muted">
                          {t("common.today")}, {formatTime(today.lastTrip.trip.endedAt ?? today.lastTrip.trip.startedAt)}
                        </div>
                      </div>
                    </Card>
                  </Link>
                )}
                {nextService && (
                  <Link href="/maintenance" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime">
                    <AlertCard
                      title={t("home.maintenanceDue", {
                        name: t(`maintenance.services.${nextService.rule.name}`),
                        distance: formatDistance(nextService.progress.remaining, vehicle.unit, 0),
                      })}
                      body={t("home.maintenanceScheduled", { value: formatDistance(nextService.nextValue, vehicle.unit, 0) })}
                      trailing={<ChevronRight className="size-5 text-muted" strokeWidth={2} aria-hidden />}
                    />
                  </Link>
                )}
              </>
            ) : (
              <SyncQueueCard entries={queue} online={online} />
            )}
          </>
        )}

        <Spacer />
        <Button size="lg" className="mb-3" onPress={startShift} isDisabled={!vehicle}>
          <Play className="size-5.5" strokeWidth={2.4} aria-hidden />
          {t("home.startShift")}
        </Button>
      </Screen>
    </>
  );
}
