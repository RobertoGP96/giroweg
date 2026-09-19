"use client";

import { TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

interface OfflineBannerProps {
  pendingCount: number;
  className?: string;
}

/** 44 px amber banner shown at the top while there is no connection. */
export function OfflineBanner({ pendingCount, className }: OfflineBannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn(
        "mx-screen flex h-11 shrink-0 items-center gap-2.5 rounded-md bg-amber px-3.5 text-secondary font-semibold text-ink",
        className,
      )}
    >
      <WifiOff className="size-4.5" strokeWidth={2.2} aria-hidden />
      {t("states.offlineBanner")}
      <span className="ml-auto font-display">{t("states.pending", { count: pendingCount })}</span>
    </div>
  );
}

interface AlertCardProps {
  title: string;
  body?: string;
  trailing?: ReactNode;
  /** 2 px amber border for blocking alerts. */
  emphasized?: boolean;
  className?: string;
}

/** Amber triangle + title + description inside a card. */
export function AlertCard({ title, body, trailing, emphasized = false, className }: AlertCardProps) {
  return (
    <Card tone={emphasized ? "alert" : "default"} className={cn("flex items-center gap-3", className)}>
      <TriangleAlert className="size-6 shrink-0 text-amber-text" strokeWidth={2} aria-hidden />
      <div className="flex-1">
        <div className="text-body font-semibold">{title}</div>
        {body && <div className="mt-0.5 text-label leading-relaxed text-muted">{body}</div>}
      </div>
      {trailing}
    </Card>
  );
}
