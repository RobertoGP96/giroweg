"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldLabel } from "./Screen";

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** Label above, control, then the error (amber) or the hint (muted). */
function FieldShell({ label, htmlFor, error, hint, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error ? (
        <p role="alert" className="text-label font-semibold text-amber-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-label text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses = (invalid: boolean): string =>
  cn(
    "w-full rounded-lg border-2 bg-surface px-4 text-body-lg text-text outline-none placeholder:text-muted",
    "focus:border-lime disabled:text-muted",
    invalid ? "border-amber" : "border-transparent",
  );

interface TextInputProps extends Omit<ComponentProps<"input">, "className"> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
}

/** 56 px text input with the field label; spreads react-hook-form's register(). */
export function TextInput({ label, error, hint, className, id, ...props }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} className={className}>
      <input id={inputId} aria-invalid={error ? true : undefined} {...props} className={cn("h-14", controlClasses(Boolean(error)))} />
    </FieldShell>
  );
}

interface TextAreaProps extends Omit<ComponentProps<"textarea">, "className"> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
}

export function TextArea({ label, error, hint, className, id, ...props }: TextAreaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} className={className}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        rows={2}
        {...props}
        className={cn("min-h-14 resize-none py-3.5", controlClasses(Boolean(error)))}
      />
    </FieldShell>
  );
}

interface SegmentedFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
}

/** Full-width segmented control for a short choice (unit of measure). */
export function SegmentedField<T extends string>({ label, value, options, onChange, disabled = false, error, hint }: SegmentedFieldProps<T>) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint}>
      <div id={id} role="radiogroup" aria-label={label} className="flex h-14 rounded-lg bg-surface p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-md text-body-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-lime",
                "disabled:cursor-not-allowed",
                active ? "bg-lime text-ink" : "text-muted cursor-pointer",
                disabled && !active && "opacity-50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
