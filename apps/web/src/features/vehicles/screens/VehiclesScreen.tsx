"use client";

import { Car, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { Button, EmptyState, ErrorState, FilterChip, IconButton, ListSkeleton, OfflineBanner, Screen, TopBar } from "@/ui";
import { VehicleCard } from "../components/VehicleCard";
import { useVehicles } from "../hooks/useVehicles";

type Filter = "active" | "archived";

export function VehiclesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const [filter, setFilter] = useState<Filter>("active");
  const vehicles = useVehicles(filter);

  useEffect(() => {
    router.prefetch("/vehicles/new");
  }, [router]);

  const addVehicle = () => router.push("/vehicles/new");
  const empty = vehicles.status === "success" && vehicles.data.length === 0;

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen>
        <TopBar
          title={t("vehicles.title")}
          large
          trailing={
            <IconButton label={t("vehicles.add")} tone="elevated" className="size-11" onPress={addVehicle}>
              <Plus className="size-5.5" strokeWidth={2.2} />
            </IconButton>
          }
        />

        <div className="flex gap-2">
          <FilterChip selected={filter === "active"} onClick={() => setFilter("active")}>
            {t("vehicles.filterActive")}
          </FilterChip>
          <FilterChip selected={filter === "archived"} onClick={() => setFilter("archived")}>
            {t("vehicles.filterArchived")}
          </FilterChip>
        </div>

        {vehicles.status === "loading" && <ListSkeleton />}
        {vehicles.status === "error" && <ErrorState onRetry={vehicles.reload} />}
        {empty && (
          <EmptyState
            icon={<Car className="size-13" strokeWidth={1.8} aria-hidden />}
            title={t(filter === "active" ? "vehicles.emptyTitle" : "vehicles.emptyArchivedTitle")}
            body={t(filter === "active" ? "vehicles.emptyBody" : "vehicles.emptyArchivedBody")}
            action={
              filter === "active" && (
                <Button size="lg" onPress={addVehicle} className="mt-2">
                  <Plus className="size-5" strokeWidth={2.4} aria-hidden />
                  {t("vehicles.add")}
                </Button>
              )
            }
          />
        )}
        {vehicles.status === "success" &&
          vehicles.data.map((summary) => <VehicleCard key={summary.vehicle.id} summary={summary} />)}
      </Screen>
    </>
  );
}
