"use client";

import { Skeleton } from "@heroui/react";
import { FolderOpen, TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

interface StateProps {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string | undefined;
}

/** Centered illustration + title + body; used for empty, error and offline states. */
export function EmptyState({ title, body, icon, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center", className)}>
      <div className="flex size-30 items-center justify-center rounded-full bg-surface text-muted">
        {icon ?? <FolderOpen className="size-13" strokeWidth={1.8} aria-hidden />}
      </div>
      <div>
        <div className="font-display text-stat font-semibold">{title}</div>
        <p className="mt-2 text-row leading-relaxed text-muted text-pretty">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      className={className}
      title={t("states.errorTitle")}
      body={t("states.errorBody")}
      icon={<TriangleAlert className="size-13 text-amber-text" strokeWidth={1.8} aria-hidden />}
      action={
        onRetry && (
          <Button variant="outline" onPress={onRetry} className="w-auto px-8">
            {t("common.retry")}
          </Button>
        )
      }
    />
  );
}

export function OfflineState({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      className={className}
      title={t("states.offlineBanner")}
      body={t("states.offlineHint")}
      icon={<WifiOff className="size-13" strokeWidth={1.8} aria-hidden />}
    />
  );
}

/** Shimmer placeholders matching a list screen (chips, summary card, rows). */
export function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5" role="status" aria-label={t("common.loading")}>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-22.5 rounded-full" />
        <Skeleton className="h-10 w-17.5 rounded-full" />
      </div>
      <Skeleton className="h-45 rounded-lg" />
      <Skeleton className="h-3.5 w-35 rounded-full" />
      <Skeleton className="h-17 rounded-lg" />
      <Skeleton className="h-17 rounded-lg" />
      <Skeleton className="h-3.5 w-30 rounded-full" />
      <Skeleton className="h-17 rounded-lg" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 rounded-full border-2 border-track border-t-lime animate-spin-slow",
        className,
      )}
    />
  );
}
