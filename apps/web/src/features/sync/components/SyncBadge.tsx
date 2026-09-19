"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { RecordSyncState } from "../hooks/useRecordSync";

interface SyncBadgeProps {
  state: RecordSyncState;
  /** Dot only (rows) or dot + label (detail screens). */
  showLabel?: boolean;
  className?: string;
}

const dotClasses: Record<RecordSyncState, string> = {
  synced: "bg-lime",
  pending: "bg-track",
  error: "bg-amber",
};

const textClasses: Record<RecordSyncState, string> = {
  synced: "text-lime-text",
  pending: "text-muted",
  error: "text-amber-text",
};

/** The UI always shows the sync state of a record (CLAUDE.md, offline). */
export function SyncBadge({ state, showLabel = false, className }: SyncBadgeProps) {
  const { t } = useTranslation();
  const label = t(`sync.state.${state}`);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-label font-semibold", textClasses[state], className)}
      role="img"
      aria-label={label}
    >
      <span className={cn("size-2 rounded-full", dotClasses[state])} aria-hidden />
      {showLabel && label}
    </span>
  );
}
