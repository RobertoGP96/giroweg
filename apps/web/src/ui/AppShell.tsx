import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * The app is a single 390–430 px column. On larger viewports it is centered
 * like a phone canvas; on phones it fills the screen.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-app flex-col bg-bg text-text",
        "pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
