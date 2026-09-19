"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * Wraps a route segment so navigations animate with the View Transitions
 * API (fade + 8 px slide, see globals.css). Mounted from each route group's
 * template.tsx, so every page change gets the same motion while the shell
 * (tab bar, header) stays still. Falls back to an instant swap in browsers
 * without view transitions and when the user prefers reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="gw-page" enter="gw-page" exit="gw-page">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
