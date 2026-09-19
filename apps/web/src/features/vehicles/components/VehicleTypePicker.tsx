"use client";

import { VEHICLE_TYPES, type VehicleType } from "@giroweg/shared/schemas";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { FieldLabel } from "@/ui";
import { VehicleTypeIcon } from "./VehicleTypeIcon";

interface VehicleTypePickerProps {
  label: string;
  value: VehicleType;
  onChange: (type: VehicleType) => void;
}

/** Grid of the seven vehicle types, icon + name, one selected. */
export function VehicleTypePicker({ label, value, onChange }: VehicleTypePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
        {VEHICLE_TYPES.map((type) => {
          const active = type === value;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(type)}
              className={cn(
                "flex h-18 flex-col items-center justify-center gap-1.5 rounded-md text-label cursor-pointer",
                "outline-none focus-visible:ring-2 focus-visible:ring-lime",
                active ? "bg-lime font-semibold text-ink" : "bg-surface font-medium text-text",
              )}
            >
              <VehicleTypeIcon type={type} className="size-6" />
              {t(`vehicles.types.${type}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
