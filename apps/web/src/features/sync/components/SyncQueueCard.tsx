"use client";

import type { TFunction } from "i18next";
import { Camera, MapPin, Receipt } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { OutboxEntry } from "@/db/store";
import { formatDistance, formatMoney, formatTime } from "@/lib/format";
import { Card, SectionLabel, Spinner } from "@/ui";

interface SyncQueueCardProps {
  entries: ReadonlyArray<OutboxEntry>;
  online: boolean;
}

/** Demo rows shown while there is nothing real in the outbox. */
const DEMO_ROWS = (t: TFunction) => [
  {
    id: "photo",
    icon: <Camera className="size-4.5" strokeWidth={2} aria-hidden />,
    title: t("sync.photoFinal"),
    line: t("sync.photoLine", { shift: "T2", time: formatTime("2026-09-18T19:14:00.000Z"), size: "1,2 MB" }),
    active: true,
  },
  {
    id: "gps",
    icon: <MapPin className="size-4.5" strokeWidth={2} aria-hidden />,
    title: t("sync.gpsRoute", { points: "1.204" }),
    line: t("sync.gpsLine", { shift: "T2", distance: formatDistance(83, "km") }),
    active: false,
  },
  {
    id: "fuel",
    icon: <Receipt className="size-4.5" strokeWidth={2} aria-hidden />,
    title: t("sync.fuelExpense", { amount: formatMoney(412.5, "MXN") }),
    line: t("sync.receiptAttached"),
    active: false,
  },
];

/** The sync queue: what is waiting in the outbox and what is being sent. */
export function SyncQueueCard({ entries, online }: SyncQueueCardProps) {
  const { t } = useTranslation();
  const rows: Array<{ id: string; icon: ReactNode; title: string; line: string; active: boolean }> =
    entries.length > 0
      ? entries.map((entry, index) => ({
          id: entry.id,
          icon: <Camera className="size-4.5" strokeWidth={2} aria-hidden />,
          title: entry.table,
          line: formatTime(entry.createdAt),
          active: online && index === 0,
        }))
      : DEMO_ROWS(t);

  return (
    <>
      <SectionLabel>{t("states.syncQueue")}</SectionLabel>
      <Card padding="none" className="flex flex-col">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={`flex h-15 items-center gap-3 px-4 ${index < rows.length - 1 ? "border-b border-line" : ""}`}
          >
            <div className="flex size-9 items-center justify-center rounded-segment bg-surface-2 text-text">{row.icon}</div>
            <div className="flex-1">
              <div className="text-body font-semibold">{row.title}</div>
              <div className="text-label text-muted">{row.line}</div>
            </div>
            {row.active ? <Spinner className="size-4.5" /> : <span className="text-label text-muted">{t("states.queued")}</span>}
          </div>
        ))}
      </Card>
      <p className="text-secondary leading-relaxed text-muted text-pretty">{t("states.offlineHint")}</p>
    </>
  );
}
