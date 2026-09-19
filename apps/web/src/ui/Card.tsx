import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "selected" | "alert" | "nested";

interface CardProps extends ComponentProps<"div"> {
  /** selected = 2 px lime border, alert = 2 px amber border, nested = surface-2 without shadow. */
  tone?: Tone;
  padding?: "none" | "sm" | "md" | "lg";
}

const toneClasses: Record<Tone, string> = {
  default: "bg-surface shadow-card",
  selected: "bg-surface shadow-card border-2 border-lime",
  alert: "bg-surface shadow-card border-2 border-amber",
  nested: "bg-surface-2",
};

const paddingClasses = {
  none: "",
  sm: "p-3.5",
  md: "px-4 py-3.5",
  lg: "p-5",
} as const;

/** Elevation without borders: radius 16, shadow from tokens. */
export function Card({ tone = "default", padding = "md", className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn("rounded-lg", toneClasses[tone], paddingClasses[padding], className)}
    />
  );
}

/** Card that is also a link or button target: same look, interactive semantics. */
export function CardButton({
  tone = "default",
  padding = "md",
  className,
  ...props
}: Omit<ComponentProps<"button">, "tone"> & { tone?: Tone; padding?: keyof typeof paddingClasses }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "w-full rounded-lg text-left text-text cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-lime",
        toneClasses[tone],
        paddingClasses[padding],
        className,
      )}
    />
  );
}
