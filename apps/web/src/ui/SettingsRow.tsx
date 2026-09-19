"use client";

import { Switch } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SettingsRowProps {
  icon?: ReactNode;
  label: string;
  /** Right side: value text, a control, etc. */
  trailing?: ReactNode;
  onPress?: (() => void) | undefined;
  last?: boolean;
}

/** 56–60 px row inside a settings card, separated by hairlines. */
export function SettingsRow({ icon, label, trailing, onPress, last = false }: SettingsRowProps) {
  const content = (
    <>
      {icon && <span className="text-muted" aria-hidden>{icon}</span>}
      <span className="flex-1 text-row font-medium">{label}</span>
      {trailing}
      {onPress && <ChevronRight className="size-5 text-muted" strokeWidth={2} aria-hidden />}
    </>
  );
  const className = cn(
    "flex h-15 w-full items-center gap-3 px-4 text-left text-text",
    !last && "border-b border-line",
  );
  if (onPress) {
    return (
      <button type="button" onClick={onPress} className={cn(className, "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime")}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

interface ToggleProps {
  label: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
}

/** HeroUI switch, 52 × 32, lime when on. Label is for assistive tech only. */
export function Toggle({ label, isSelected, onChange }: ToggleProps) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} aria-label={label} className="shrink-0">
      <Switch.Control className="h-8 w-13 bg-track data-[selected]:bg-lime">
        <Switch.Thumb className="size-6.5 bg-bg data-[selected]:bg-ink" />
      </Switch.Control>
    </Switch>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** Small segmented control (theme selector). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-segment bg-surface-2 p-0.75">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-label cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-lime",
              active ? "bg-bg font-semibold text-text" : "text-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
