"use client";

import { Car, Gauge, type LucideIcon, Map, RefreshCw, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStore } from "@/db/client";
import type { LocalStore, OutboxEntry, TableName } from "@/db/store";
import { cn } from "@/lib/cn";
import { formatDateTime, formatOdometer, formatTime } from "@/lib/format";
import { Button, Card, SectionLabel, Spinner } from "@/ui";
import { retryNow } from "../engine";
import { syncErrorMessage } from "../errorMessage";
import { useSyncStatus } from "../store";

interface SyncQueueCardProps {
  entries: ReadonlyArray<OutboxEntry>;
  online: boolean;
}

const ICONS: Record<TableName, LucideIcon> = {
  vehicles: Car,
  readings: Gauge,
  trips: Route,
  tripRoutes: Map,
};

const vehicleName = (store: LocalStore, vehicleId: string): string | undefined =>
  store.table("vehicles").find((row) => row.id === vehicleId)?.name;

/** A trip in words: its vehicle and when it started. */
const describeTrip = (store: LocalStore, tripId: string): string | undefined => {
  const trip = store.table("trips").find((row) => row.id === tripId);
  if (!trip) return undefined;
  const name = vehicleName(store, trip.vehicleId);
  const when = formatDateTime(trip.startedAt);
  return name ? `${name} · ${when}` : when;
};

/**
 * What each pending entry is, in words: the vehicle name, the reading value,
 * or the trip (a route is described through its trip).
 */
const describe = (entry: OutboxEntry): string => {
  const store = getStore();
  switch (entry.table) {
    case "vehicles":
      return vehicleName(store, entry.recordId) ?? entry.recordId;
    case "readings": {
      const reading = store.table("readings").find((row) => row.id === entry.recordId);
      if (!reading) return entry.recordId;
      const vehicle = store.table("vehicles").find((row) => row.id === reading.vehicleId);
      return `${formatOdometer(reading.value)} ${vehicle?.unit ?? ""}`.trim();
    }
    case "trips":
      return describeTrip(store, entry.recordId) ?? entry.recordId;
    case "tripRoutes": {
      const route = store.table("tripRoutes").find((row) => row.id === entry.recordId);
      return (route && describeTrip(store, route.tripId)) ?? entry.recordId;
    }
  }
};

/** The sync queue: what is waiting in the outbox and what is being sent. */
export function SyncQueueCard({ entries, online }: SyncQueueCardProps) {
  const { t } = useTranslation();
  const syncing = useSyncStatus((s) => s.syncing);
  const hasErrors = entries.some((entry) => entry.lastError !== null);

  if (entries.length === 0) return null;

  return (
    <>
      <SectionLabel>{t("states.syncQueue")}</SectionLabel>
      <Card padding="none" className="flex flex-col">
        {entries.map((entry, index) => {
          const Icon = ICONS[entry.table];
          const active = online && syncing && index === 0;
          return (
            <div
              key={entry.id}
              className={cn("flex min-h-15 items-center gap-3 px-4 py-2", index < entries.length - 1 && "border-b border-line")}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-segment bg-surface-2 text-text">
                <Icon className="size-4.5" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold">
                  {t(`sync.table.${entry.table}`)} · {describe(entry)}
                </div>
                <div className={cn("text-label", entry.lastError ? "text-amber-text" : "text-muted")}>
                  {entry.lastError ? syncErrorMessage(t, entry.lastError) : formatTime(entry.createdAt)}
                </div>
              </div>
              {active ? <Spinner className="size-4.5" /> : <span className="text-label text-muted">{t("states.queued")}</span>}
            </div>
          );
        })}
      </Card>
      {online && (hasErrors || !syncing) && (
        <Button variant="outline" size="md" onPress={() => void retryNow()} isDisabled={syncing} className="text-body-lg">
          <RefreshCw className="size-5" strokeWidth={2} aria-hidden />
          {t("sync.retry")}
        </Button>
      )}
      {!online && <p className="text-secondary leading-relaxed text-muted text-pretty">{t("states.offlineHint")}</p>}
    </>
  );
}
