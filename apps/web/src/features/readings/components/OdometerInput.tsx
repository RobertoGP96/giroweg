"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatOdometer } from "@/lib/format";
import { Card, IconButton } from "@/ui";

interface OdometerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Visual hint: "focused" lime border or "error" amber border. */
  tone?: "focused" | "error" | "plain";
  label: string;
  /** Right side: −/+ steppers (default) or a hint text. */
  hint?: string | undefined;
  className?: string | undefined;
}

/**
 * The OCR value is only a suggestion: it is always shown in an editable
 * field and the driver confirms it (domain rule 6). Integer odometer with
 * −/+ steppers for quick corrections.
 */
export function OdometerInput({ value, onChange, tone = "focused", label, hint, className }: OdometerInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const step = (delta: number) => onChange(Math.max(0, (value ?? 0) + delta));

  return (
    <Card
      tone={tone === "error" ? "alert" : tone === "focused" ? "selected" : "default"}
      padding="none"
      className={cn("flex items-center justify-between py-3.5 pr-3.5 pl-5", className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === null ? "" : formatOdometer(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits === "" ? null : Number(digits));
        }}
        placeholder="000000"
        className={cn(
          "min-w-0 flex-1 bg-transparent font-display text-odometer font-bold tracking-wide outline-none",
          value === null ? "text-muted" : "text-text",
          "placeholder:text-muted",
        )}
      />
      {hint ? (
        <span className="text-secondary text-muted">{hint}</span>
      ) : (
        <div className="flex gap-1.5">
          <IconButton label={t("shift.decrease")} tone="surface" onPress={() => step(-1)}>
            <Minus className="size-6" strokeWidth={2.4} />
          </IconButton>
          <IconButton label={t("shift.increase")} tone="surface" onPress={() => step(1)}>
            <Plus className="size-6" strokeWidth={2.4} />
          </IconButton>
        </div>
      )}
    </Card>
  );
}
