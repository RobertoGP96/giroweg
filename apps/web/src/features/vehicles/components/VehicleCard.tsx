"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { formatOdometer } from "@/lib/format";
import { SyncBadge } from "@/features/sync/components/SyncBadge";
import { useRecordSync } from "@/features/sync/hooks/useRecordSync";
import { Card, SharedElement, StatusPill, navOptions } from "@/ui";
import { primeVehicleDetail, type VehicleSummary } from "../hooks/useVehicles";
import { VehicleTypeIcon } from "./VehicleTypeIcon";

interface VehicleCardProps {
  summary: VehicleSummary;
}

/**
 * One vehicle in the list: type, name, plate, current odometer and sync
 * state. Pressing it warms the detail's data so the next screen opens with
 * content; the type icon glides into the detail header.
 */
export function VehicleCard({ summary }: VehicleCardProps) {
  const { t } = useTranslation();
  const { vehicle, odometer } = summary;
  const sync = useRecordSync(vehicle.id);
  const prime = () => primeVehicleDetail(vehicle.id);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      {...navOptions("forward")}
      onPointerDown={prime}
      onFocus={prime}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <Card padding="sm" className="flex items-center gap-3.5">
        <SharedElement name={`vehicle-icon-${vehicle.id}`}>
          <div className="flex h-16 w-18 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
            <VehicleTypeIcon type={vehicle.type} className="size-8" />
          </div>
        </SharedElement>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-button font-semibold">{vehicle.name}</div>
          <div className="mt-0.5 truncate text-secondary text-muted">
            {t(`vehicles.types.${vehicle.type}`)}
            {vehicle.plate && (
              <>
                {" · "}
                <span className="font-display font-semibold tracking-wide text-text">{vehicle.plate}</span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-display text-figure-sm font-semibold">
              {formatOdometer(odometer)} <span className="text-secondary font-medium text-muted">{vehicle.unit}</span>
            </span>
            {vehicle.archivedAt && <StatusPill tone="muted">{t("vehicles.filterArchived")}</StatusPill>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SyncBadge state={sync} />
          <ChevronRight className="size-5 text-muted" strokeWidth={2} aria-hidden />
        </div>
      </Card>
    </Link>
  );
}
