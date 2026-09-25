"use client";

import { Skeleton } from "@heroui/react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { RoutePoint } from "@giroweg/shared/domain";
import { cn } from "@/lib/cn";
import { Card } from "@/ui";
import { MapErrorBoundary } from "./MapErrorBoundary";

const RouteMapCanvas = dynamic(() => import("./RouteMapCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

type Segments = readonly (readonly RoutePoint[])[];

export interface RouteMapProps {
  segments: Segments;
  /** live: fills the screen and follows the vehicle. detail: fixed height, fits the route. */
  mode: "live" | "detail";
  /** Accessible name of the map, already translated. */
  label: string;
  /** Shown over the map while there are no points yet. */
  emptyText?: string | undefined;
  className?: string | undefined;
  /**
   * Overlay slot on top of the map. The slot ignores pointer events so the
   * map stays pannable in detail mode; interactive children opt back in
   * with `pointer-events-auto`.
   */
  children?: ReactNode;
  onTilesFailed?: ((failed: boolean) => void) | undefined;
}

const heightClasses: Record<RouteMapProps["mode"], string> = {
  live: "flex-1 min-h-64",
  detail: "h-72",
};

function MapUnavailable() {
  const { t } = useTranslation();
  return (
    <Card tone="nested" padding="lg" className="flex size-full items-center justify-center text-center">
      <p className="text-body text-muted text-pretty">{t("trips.mapUnavailable")}</p>
    </Card>
  );
}

const hasPoints = (segments: Segments): boolean => segments.some((segment) => segment.length > 0);

/** Route map with loading skeleton, WebGL fallback and an overlay slot. */
export function RouteMap({
  segments,
  mode,
  label,
  emptyText,
  className,
  children,
  onTilesFailed,
}: RouteMapProps) {
  const empty = !hasPoints(segments);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative overflow-hidden rounded-lg bg-map", heightClasses[mode], className)}
    >
      <MapErrorBoundary fallback={<MapUnavailable />}>
        <RouteMapCanvas segments={segments} mode={mode} onTilesFailed={onTilesFailed} />
      </MapErrorBoundary>
      {empty && emptyText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-body font-medium text-muted text-pretty">{emptyText}</p>
        </div>
      )}
      {children && <div className="pointer-events-none absolute inset-0 z-10">{children}</div>}
    </div>
  );
}
