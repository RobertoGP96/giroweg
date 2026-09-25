"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Navigation helpers that tell the route transition which way we are going.
 * Every navigation carries a React transition type; PageTransition maps it
 * to the matching animation (slide in from the right, slide back, tab fade).
 *
 * The browser's own back/forward (button, swipe) is not animated: React
 * renders updates dispatched during `popstate` synchronously so the browser
 * can restore scroll, and a synchronous commit never starts a view
 * transition. In-app "back" controls therefore navigate with a typed
 * push/replace instead of `router.back()`.
 */
export type NavDirection = "forward" | "back" | "tab";

export const NAV_TYPE = {
  forward: "nav-forward",
  back: "nav-back",
  tab: "nav-tab",
} as const;

/** Options for `router.push` / `router.replace` and the `Link` prop `transitionTypes`. */
export const navOptions = (direction: NavDirection): { transitionTypes: string[] } => ({
  transitionTypes: [NAV_TYPE[direction]],
});

/**
 * Router with direction-aware transitions and a pending flag for the control
 * that started the navigation (buttons show it while the next screen loads).
 */
export const useNavigate = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const push = useCallback(
    (href: string, direction: NavDirection = "forward") => {
      startTransition(() => router.push(href, navOptions(direction)));
    },
    [router],
  );

  const replace = useCallback(
    (href: string, direction: NavDirection = "forward") => {
      startTransition(() => router.replace(href, navOptions(direction)));
    },
    [router],
  );

  /** The screen's back control: goes to the parent screen with the return animation. */
  const back = useCallback((href: string) => push(href, "back"), [push]);

  /** A flow finished (saved, confirmed): leave it without keeping it in history. */
  const done = useCallback((href: string) => replace(href, "back"), [replace]);

  const prefetch = useCallback((href: string) => router.prefetch(href), [router]);

  return { push, replace, back, done, prefetch, pending };
};
