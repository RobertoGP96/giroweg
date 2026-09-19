"use client";

import type { VehicleFormOutput } from "@giroweg/shared/schemas";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSession } from "@/db/hooks";
import { useAsync } from "@/lib/useAsync";
import { syncNow } from "@/features/sync/engine";
import { useSyncStatus } from "@/features/sync/store";
import { AlertCard, Button, Card, ErrorState, ListSkeleton, Screen, TopBar } from "@/ui";
import { VehicleForm } from "../components/VehicleForm";
import { selectVehicle, vehiclesRepository } from "../repository";

interface VehicleFormScreenProps {
  /** Present when editing an existing vehicle. */
  vehicleId?: string | undefined;
}

export function VehicleFormScreen({ vehicleId }: VehicleFormScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useLocalSession();
  const { syncing, lastError } = useSyncStatus();
  const editing = vehicleId !== undefined;
  const existing = useAsync(async () => {
    if (!vehicleId) return null;
    const vehicle = await vehiclesRepository.getById(vehicleId);
    if (!vehicle) throw new Error("Vehicle not found");
    return { vehicle, readingCount: await vehiclesRepository.readingCount(vehicleId) };
  }, [vehicleId]);

  const submit = async (input: VehicleFormOutput) => {
    const saved = vehicleId ? await vehiclesRepository.update(vehicleId, input) : await vehiclesRepository.create(input);
    selectVehicle(saved.id);
    router.replace(`/vehicles/${saved.id}`);
  };

  const backHref = vehicleId ? `/vehicles/${vehicleId}` : "/vehicles";

  return (
    <Screen className="pt-1">
      <TopBar title={t(editing ? "vehicles.editTitle" : "vehicles.newTitle")} backHref={backHref} />

      {editing && existing.status === "loading" && <ListSkeleton />}
      {editing && existing.status === "error" && <ErrorState onRetry={existing.reload} />}

      {(!editing || existing.status === "success") && (
        <>
          {!session && (
            <AlertCard
              emphasized={lastError !== null}
              title={t("vehicles.form.errors.noSession")}
              body={lastError ? t("sync.bootstrapFailed", { error: lastError }) : t("sync.bootstrapPending")}
              trailing={
                <Button variant="outline" size="md" className="w-auto px-4" isDisabled={syncing} isPending={syncing} onPress={() => void syncNow()}>
                  {t("common.retry")}
                </Button>
              }
            />
          )}
          <VehicleForm
            vehicle={existing.data?.vehicle}
            unitLocked={(existing.data?.readingCount ?? 0) > 0}
            submitLabel={t(editing ? "vehicles.form.update" : "vehicles.form.create")}
            disabled={!session}
            onSubmit={submit}
          />
          {vehicleId && existing.data && <ArchiveSection vehicleId={vehicleId} archived={existing.data.vehicle.archivedAt !== null} />}
        </>
      )}
    </Screen>
  );
}

function ArchiveSection({ vehicleId, archived }: { vehicleId: string; archived: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const setArchived = async (value: boolean) => {
    setBusy(true);
    try {
      await vehiclesRepository.setArchived(vehicleId, value);
      if (value) selectVehicle(null);
      router.replace(value ? "/vehicles" : `/vehicles/${vehicleId}`);
    } finally {
      setBusy(false);
    }
  };

  if (archived) {
    return (
      <Button variant="outline" size="md" isDisabled={busy} isPending={busy} onPress={() => void setArchived(false)}>
        {t("vehicles.restore")}
      </Button>
    );
  }

  if (!confirming) {
    return (
      <Button variant="destructive" size="md" onPress={() => setConfirming(true)}>
        {t("vehicles.archive")}
      </Button>
    );
  }

  return (
    <Card tone="alert" className="flex flex-col gap-3">
      <div className="text-body font-semibold">{t("vehicles.archive")}</div>
      <p className="text-secondary leading-relaxed text-muted">{t("vehicles.archiveConfirmBody")}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" className="flex-1" onPress={() => setConfirming(false)}>
          {t("common.cancel")}
        </Button>
        <Button variant="destructive" size="md" className="flex-1 bg-surface-2" isDisabled={busy} isPending={busy} onPress={() => void setArchived(true)}>
          {t("vehicles.archiveConfirm")}
        </Button>
      </div>
    </Card>
  );
}
