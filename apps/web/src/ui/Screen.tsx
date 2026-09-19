import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Full-height column with the 20 px mobile screen margin. Content grows and
 * the primary action stays in the bottom third via `Spacer`.
 */
export function Screen({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      {...props}
      className={cn("flex min-h-0 flex-1 flex-col gap-3.5 px-screen pt-2 pb-5", className)}
    />
  );
}

/** Pushes what follows to the bottom of the screen. */
export function Spacer() {
  return <div className="flex-1" aria-hidden />;
}

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

/** 12/600 uppercase muted label above a group. */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cn("text-label font-semibold uppercase tracking-wide text-muted", className)}>
      {children}
    </div>
  );
}

interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FieldLabel({ children, htmlFor, className }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn("text-secondary text-muted", className)}>
      {children}
    </label>
  );
}
