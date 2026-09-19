"use client";

import type { Vehicle } from "@giroweg/shared/schemas";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatOdometer } from "@/lib/format";
import { CardButton, StatusPill } from "@/ui";
import type { VehicleStatus } from "../repository";
import { VehicleTypeIcon } from "./VehicleTypeIcon";

interface VehicleCardProps {
  vehicle: Vehicle;
  odometer: number;
  status: VehicleStatus;
  selected: boolean;
  onSelect: () => void;
}

export function VehicleCard({ vehicle, odometer, status, selected, onSelect }: VehicleCardProps) {
  const { t } = useTranslation();
  return (
    <CardButton
      tone={selected ? "selected" : "default"}
      padding="sm"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex items-center gap-3.5"
    >
      <div className="flex h-18 w-22 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
        <VehicleTypeIcon type={vehicle.type} className="size-9" />
      </div>
      <div className="flex-1">
        <div className="font-display text-button font-semibold">{vehicle.name}</div>
        <div className="mt-0.5 text-secondary text-muted">
          {t(`vehicles.types.${vehicle.type}`)}
          {vehicle.plate && (
            <>
              {" · "}
              <span className="font-display font-semibold tracking-wide text-text">{vehicle.plate}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 font-display text-figure-sm font-semibold">
          {formatOdometer(odometer)}{" "}
          <span className="text-secondary font-medium text-muted">{vehicle.unit}</span>
        </div>
      </div>
      {selected ? (
        <CircleCheck className="size-6 text-lime-text" strokeWidth={2.4} aria-hidden />
      ) : status === "workshop" ? (
        <StatusPill tone="amber">{t("vehicles.status.workshop")}</StatusPill>
      ) : null}
    </CardButton>
  );
}
