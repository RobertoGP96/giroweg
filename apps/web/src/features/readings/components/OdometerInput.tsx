"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatInputNumber } from "@/lib/format";
import { Card, IconButton } from "@/ui";

interface OdometerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Visual hint: "focused" lime border or "error" amber border. */
  tone?: "focused" | "error" | "plain";
  label: string;
  unit: string;
  className?: string | undefined;
}

/** Digits with at most one decimal (numeric(10,1)); comma or dot accepted. */
const normalize = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const match = /^(\d*)(\.\d?)?/.exec(cleaned);
  return match ? `${match[1] ?? ""}${match[2] ?? ""}` : "";
};

/**
 * The odometer value is always an editable field the user confirms before
 * saving (domain rule 6), with −/+ steppers for quick corrections.
 */
export function OdometerInput({ value, onChange, tone = "focused", label, unit, className }: OdometerInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(value === null ? "" : formatInputNumber(value));

  const update = (next: string) => {
    setText(next);
    const parsed = next === "" || next === "." ? null : Number(next);
    onChange(parsed === null || Number.isNaN(parsed) ? null : parsed);
  };

  const step = (delta: number) => {
    const next = Math.max(0, Math.round(((value ?? 0) + delta) * 10) / 10);
    update(formatInputNumber(next));
  };

  return (
    <Card
      tone={tone === "error" ? "alert" : tone === "focused" ? "selected" : "default"}
      padding="none"
      className={cn("flex items-center gap-2 py-3 pr-3 pl-5", className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event) => update(normalize(event.target.value))}
        placeholder="0"
        className={cn(
          "min-w-0 flex-1 bg-transparent font-display text-odometer font-bold tracking-wide outline-none",
          "placeholder:text-muted",
        )}
      />
      <span className="text-body-lg font-semibold text-muted" aria-hidden>
        {unit}
      </span>
      <div className="flex gap-1.5">
        <IconButton label={t("readings.decrease")} tone="surface" className="size-12" onPress={() => step(-1)}>
          <Minus className="size-6" strokeWidth={2.4} />
        </IconButton>
        <IconButton label={t("readings.increase")} tone="surface" className="size-12" onPress={() => step(1)}>
          <Plus className="size-6" strokeWidth={2.4} />
        </IconButton>
      </div>
    </Card>
  );
}
