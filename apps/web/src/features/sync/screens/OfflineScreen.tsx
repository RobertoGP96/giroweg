"use client";

import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { AppShell, Button, EmptyState, Screen } from "@/ui";

/** Fallback page for uncached routes while offline; retries a full reload. */
export function OfflineScreen() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  return (
    <AppShell>
      <Screen>
        <EmptyState
          title={t("states.offlinePageTitle")}
          body={t("states.offlinePageBody")}
          icon={<WifiOff className="size-13" strokeWidth={1.8} aria-hidden />}
          action={
            <Button variant="outline" onPress={() => window.location.replace("/home")} className="w-auto px-8">
              {online ? t("states.offlineBackToApp") : t("common.retry")}
            </Button>
          }
        />
      </Screen>
    </AppShell>
  );
}
