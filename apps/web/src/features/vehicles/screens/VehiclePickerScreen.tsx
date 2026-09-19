"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { currentUser } from "@/db/seed";
import { Button, ErrorState, ListSkeleton, Screen, Spacer } from "@/ui";
import { VehicleCard } from "../components/VehicleCard";
import { useVehicles } from "../hooks/useVehicles";

export function VehiclePickerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const vehicles = useVehicles();
  const [selectedId, setSelectedId] = useState<string>(currentUser.activeVehicleId);
  const selected = vehicles.data?.find((v) => v.vehicle.id === selectedId);

  return (
    <Screen>
      <div className="pt-2">
        <h1 className="font-display text-screen-title font-bold leading-tight">{t("vehicles.title")}</h1>
        <p className="mt-1.5 text-body text-muted">{t("vehicles.assignedTo", { name: currentUser.name })}</p>
      </div>

      {vehicles.status === "loading" && <ListSkeleton />}
      {vehicles.status === "error" && <ErrorState onRetry={vehicles.reload} />}
      {vehicles.status === "success" &&
        vehicles.data.map(({ vehicle, odometer, status }) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            odometer={odometer}
            status={status}
            selected={vehicle.id === selectedId}
            onSelect={() => setSelectedId(vehicle.id)}
          />
        ))}

      <Button variant="ghost" size="md" className="text-body font-body font-normal">
        <Plus className="size-4.5" strokeWidth={2} aria-hidden />
        {t("vehicles.scanOther")}
      </Button>

      <Spacer />
      <Button size="md" className="mb-9 h-15 text-button-md" isDisabled={!selected} onPress={() => router.push("/home")}>
        {t("vehicles.continueWith", { plate: selected?.vehicle.plate ?? "" })}
      </Button>
    </Screen>
  );
}
