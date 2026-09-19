"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FilterChipProps extends Omit<ComponentProps<"button">, "children"> {
  selected?: boolean;
  children: ReactNode;
}

/** 40–44 px pill used for filters and type selectors. */
export function FilterChip({ selected = false, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-body cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-lime",
        selected ? "bg-lime font-semibold text-ink" : "bg-surface font-medium text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type StatusTone = "lime" | "amber" | "muted";

interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  /** Solid pill (lime/amber background) instead of dot + label. */
  solid?: boolean;
  className?: string;
}

const dotClasses: Record<StatusTone, string> = {
  lime: "bg-lime",
  amber: "bg-amber",
  muted: "bg-track",
};

const textClasses: Record<StatusTone, string> = {
  lime: "text-text",
  amber: "text-amber-text",
  muted: "text-muted",
};

const solidClasses: Record<StatusTone, string> = {
  lime: "bg-lime text-ink",
  amber: "bg-amber text-ink",
  muted: "bg-surface-2 text-muted",
};

/** 28 px status pill: dot + label, or solid for OCR / capture feedback. */
export function StatusPill({ tone, children, solid = false, className }: StatusPillProps) {
  if (solid) {
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-full px-2.5 text-label font-semibold",
          solidClasses[tone],
          className,
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-label font-semibold",
        textClasses[tone],
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", dotClasses[tone])} aria-hidden />
      {children}
    </span>
  );
}
