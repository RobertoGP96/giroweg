"use client";

import { useTranslation } from "react-i18next";
import { StatusPill, type StatusTone } from "@/ui";
import type { GpsState } from "../tracking";

interface GpsStatusPillProps {
  gps: GpsState;
  accuracyM: number | null;
  paused: boolean;
  className?: string | undefined;
}

const tones: Record<GpsState, StatusTone> = {
  searching: "muted",
  ok: "lime",
  weak: "amber",
  timeout: "amber",
  denied: "amber",
  unavailable: "amber",
};

/** Live GPS signal state; announced politely so the driver hears changes. */
export function GpsStatusPill({ gps, accuracyM, paused, className }: GpsStatusPillProps) {
  const { t } = useTranslation();
  const key = paused ? "paused" : gps;
  const tone: StatusTone = paused ? "muted" : tones[gps];
  const accuracy = accuracyM === null ? "–" : String(Math.round(accuracyM));
  return (
    <StatusPill tone={tone} {...(className ? { className } : {})}>
      <span role="status" aria-live="polite">
        {t(`trips.gpsStatus.${key}`, { accuracy })}
      </span>
    </StatusPill>
  );
}
