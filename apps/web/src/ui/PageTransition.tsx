"use client";

import { ViewTransition, type ReactNode } from "react";
import { NAV_TYPE } from "./navigation";

/**
 * Maps the navigation's transition type (src/ui/navigation.ts) to the
 * animation classes in globals.css. Anything untyped (a skeleton revealing
 * its content, an external link) gets the plain fade.
 */
const PAGE_CLASSES = {
  [NAV_TYPE.forward]: "gw-page-forward",
  [NAV_TYPE.back]: "gw-page-back",
  [NAV_TYPE.tab]: "gw-page-tab",
  default: "gw-page",
};

/**
 * Wraps a route segment so navigations animate with the View Transitions
 * API. Mounted from each route group's template.tsx, so every page change
 * gets the same motion while the shell (tab bar) stays still. Falls back to
 * an instant swap in browsers without view transitions and when the user
 * prefers reduced motion (globals.css).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default={PAGE_CLASSES}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
