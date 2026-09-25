"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "./registerServiceWorker";

/** Registers the service worker once the app is interactive. Renders nothing. */
export function PwaBoot() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
