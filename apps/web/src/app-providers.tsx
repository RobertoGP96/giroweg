"use client";

import type { ReactNode } from "react";
import { SyncBoot } from "@/features/sync/SyncBoot";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SyncBoot />
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}
