import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FigureSize = "display" | "total" | "ring" | "odometer" | "card" | "row";

interface FigureProps {
  value: ReactNode;
  unit?: string;
  size?: FigureSize;
  className?: string;
  tone?: "text" | "lime" | "amber" | "muted";
}

const sizeClasses: Record<FigureSize, string> = {
  display: "text-display leading-none font-bold tracking-tight",
  total: "text-shift-total leading-tight font-bold tracking-tight",
  ring: "text-ring leading-none font-bold tracking-tight",
  odometer: "text-odometer leading-tight font-bold",
  card: "text-stat leading-tight font-semibold",
  row: "text-button leading-tight font-semibold",
};

const unitClasses: Record<FigureSize, string> = {
  display: "text-card-title",
  total: "text-card-title",
  ring: "text-figure-sm",
  odometer: "text-body-lg",
  card: "text-body",
  row: "text-secondary",
};

const toneClasses = {
  text: "text-text",
  lime: "text-lime-text",
  amber: "text-amber-text",
  muted: "text-muted",
} as const;

/** A figure in Space Grotesk with tabular numerals and an optional unit. */
export function Figure({ value, unit, size = "card", className, tone = "text" }: FigureProps) {
  return (
    <div className={cn("flex items-baseline gap-2 font-display", toneClasses[tone], className)}>
      <span className={sizeClasses[size]}>{value}</span>
      {unit && <span className={cn("font-semibold text-muted", unitClasses[size])}>{unit}</span>}
    </div>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  className?: string;
}

/** Small labelled figure used in stat grids: label 12 muted, value 17–22 display. */
export function Stat({ label, value, unit, className }: StatProps) {
  return (
    <div className={className}>
      <div className="text-label text-muted">{label}</div>
      <div className="mt-0.5 font-display text-button font-semibold">
        {value}
        {unit && <span className="ml-1 text-secondary font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}
