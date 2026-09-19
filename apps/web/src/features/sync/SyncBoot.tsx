"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSessionUser } from "@/auth/useSessionUser";
import { getStore } from "@/db/client";
import { isDue, syncNow } from "./engine";

const PUBLIC_ROUTES = /^\/(login|onboarding)(\/|$)/;
const PUSH_DEBOUNCE_MS = 800;
const RETRY_INTERVAL_MS = 60_000;
/** Until the device knows its organization nothing can be written: retry the first pull often. */
const BOOTSTRAP_RETRY_MS = 10_000;

/**
 * Starts the sync engine for a signed-in user: on load, when the network
 * comes back, shortly after every local write, and periodically while the
 * outbox has something waiting or the first pull has not succeeded yet.
 * Renders nothing.
 */
export function SyncBoot() {
  const pathname = usePathname();
  const { user } = useSessionUser();
  const enabled = user !== null && !PUBLIC_ROUTES.test(pathname);

  useEffect(() => {
    if (!enabled) return;
    const store = getStore();
    const hasDueWork = () => store.outbox.some((entry) => isDue(entry));

    void syncNow();
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);

    const interval = window.setInterval(() => {
      if (hasDueWork()) void syncNow();
    }, RETRY_INTERVAL_MS);
    const bootstrap = window.setInterval(() => {
      if (store.session === null) void syncNow();
    }, BOOTSTRAP_RETRY_MS);

    let timer: number | undefined;
    const unsubscribe = store.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (hasDueWork()) void syncNow();
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      window.clearInterval(bootstrap);
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);

  return null;
}
