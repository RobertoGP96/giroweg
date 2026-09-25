"use client";

import type { ReactNode } from "react";
import { SyncBoot } from "@/features/sync/SyncBoot";
import { TripBoot } from "@/features/trips/TripBoot";
import { I18nProvider } from "@/i18n/I18nProvider";
import { PwaBoot } from "@/pwa/PwaBoot";
import { ThemeProvider } from "@/theme/ThemeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SyncBoot />
        <TripBoot />
        <PwaBoot />
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}
