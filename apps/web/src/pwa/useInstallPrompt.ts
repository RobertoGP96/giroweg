"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** Chromium's beforeinstallprompt event; not part of lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isInstallPromptEvent = (event: Event): event is BeforeInstallPromptEvent => "prompt" in event;

const STANDALONE_QUERY = "(display-mode: standalone)";

// --- "running from the home screen" as an external store ------------------

const subscribeStandalone = (callback: () => void) => {
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
};

const readStandalone = () =>
  window.matchMedia(STANDALONE_QUERY).matches ||
  ("standalone" in navigator && navigator.standalone === true);

export interface InstallPrompt {
  /** True when the browser offers to install and the app is not installed yet. */
  canInstall: boolean;
  /** True while running from the home screen. */
  installed: boolean;
  /** Opens the browser's install dialog. */
  install: () => Promise<void>;
}

/**
 * Captures the deferred install prompt (Android/desktop Chromium) so the app
 * can offer "Instalar" from its own UI. iOS has no prompt: there the user adds
 * the app from Safari's share sheet, which the manifest already supports.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(subscribeStandalone, readStandalone, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      if (!isInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setDeferred(null);
  }, [deferred]);

  return { canInstall: deferred !== null && !installed, installed, install };
}
