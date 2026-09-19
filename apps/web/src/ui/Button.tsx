"use client";

import { Button as HeroButton } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type HeroButtonProps = ComponentProps<typeof HeroButton>;

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "lg" | "md";

interface ButtonProps extends Omit<HeroButtonProps, "variant" | "size" | "children" | "className"> {
  variant?: ButtonVariant;
  className?: string | undefined;
  /** lg = 64 px primary action, md = 56 px (minimum touch target). */
  size?: ButtonSize;
  children: ReactNode;
}

const heroVariant: Record<ButtonVariant, HeroButtonProps["variant"]> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  destructive: "ghost",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-lime text-ink data-[hovered]:bg-lime data-[pressed]:opacity-90",
  secondary: "bg-surface-2 text-text data-[hovered]:bg-surface-2",
  outline: "border-2 border-surface-2 bg-transparent text-text data-[hovered]:bg-surface",
  ghost: "bg-transparent text-muted data-[hovered]:bg-surface",
  destructive: "bg-transparent text-red data-[hovered]:bg-surface",
};

const sizeClasses: Record<ButtonSize, string> = {
  lg: "h-16 text-button-lg",
  md: "h-14 text-button",
};

/**
 * GiroWeg button on top of HeroUI. Always at least 56 px tall, radius 16,
 * Space Grotesk semibold label. Icons go as children before the label.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <HeroButton
      variant={heroVariant[variant]}
      fullWidth
      {...props}
      className={cn(
        "rounded-lg font-display font-semibold gap-2.5 px-5 shadow-none",
        "data-[disabled]:bg-surface-2 data-[disabled]:text-muted",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </HeroButton>
  );
}

interface IconButtonProps extends Omit<HeroButtonProps, "variant" | "size" | "children" | "className"> {
  className?: string | undefined;
  /** Required: icon-only controls need an accessible name. */
  label: string;
  children: ReactNode;
  tone?: "surface" | "plain" | "elevated";
}

/** 56 × 56 icon-only control (44 px visual minimum inside a 56 px target). */
export function IconButton({ label, children, tone = "plain", className, ...props }: IconButtonProps) {
  return (
    <HeroButton
      variant="ghost"
      isIconOnly
      aria-label={label}
      {...props}
      className={cn(
        "size-14 shrink-0 rounded-md text-text shadow-none",
        tone === "surface" && "bg-surface-2",
        tone === "elevated" && "bg-surface shadow-card",
        tone === "plain" && "bg-transparent",
        className,
      )}
    >
      {children}
    </HeroButton>
  );
}
