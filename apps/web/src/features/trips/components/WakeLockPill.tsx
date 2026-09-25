"use client";

import { useTranslation } from "react-i18next";
import { Button, StatusPill } from "@/ui";
import type { WakeLockState } from "../wakeLock";

interface WakeLockPillProps {
  state: WakeLockState;
  onRetry: () => void;
  className?: string | undefined;
}

/** Warns when the screen may turn off during the trip; hidden while the lock is held. */
export function WakeLockPill({ state, onRetry, className }: WakeLockPillProps) {
  const { t } = useTranslation();
  if (state === "held") return null;
  if (state === "unsupported") {
    return (
      <StatusPill tone="muted" {...(className ? { className } : {})}>
        {t("trips.wakeLock.unsupported")}
      </StatusPill>
    );
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="amber">{t("trips.wakeLock.released")}</StatusPill>
        <Button variant="secondary" size="md" onPress={onRetry} className="w-auto px-4">
          {t("trips.wakeLock.retry")}
        </Button>
      </div>
    </div>
  );
}
