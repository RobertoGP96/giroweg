import type { VehicleType } from "@giroweg/shared/schemas";
import { Bike, Car, Tractor, Truck, type LucideProps } from "lucide-react";

const ICONS: Record<VehicleType, typeof Bike> = {
  motorcycle: Bike,
  bicycle: Bike,
  car: Car,
  pickup: Truck,
  van: Truck,
  truck: Truck,
  machinery: Tractor,
};

interface VehicleTypeIconProps extends LucideProps {
  type: VehicleType;
}

export function VehicleTypeIcon({ type, ...props }: VehicleTypeIconProps) {
  const Icon = ICONS[type];
  return <Icon strokeWidth={2} aria-hidden {...props} />;
}
