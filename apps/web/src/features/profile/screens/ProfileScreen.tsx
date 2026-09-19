"use client";

import { Avatar } from "@heroui/react";
import { Globe, Moon, RefreshCw, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/auth/client";
import { useSessionUser } from "@/auth/useSessionUser";
import { getStore } from "@/db/client";
import { useStoreVersion } from "@/db/hooks";
import { clearPersistedState } from "@/db/persistence";
import { formatTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { readingsRepository } from "@/features/readings/repository";
import { SyncQueueCard } from "@/features/sync/components/SyncQueueCard";
import { syncNow } from "@/features/sync/engine";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useSyncQueue } from "@/features/sync/hooks/useSyncQueue";
import { useSyncStatus } from "@/features/sync/store";
import { useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { Card, OfflineBanner, Screen, SectionLabel, Segmented, SettingsRow, Spinner } from "@/ui";

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const { syncing, lastSyncAt, lastError } = useSyncStatus();
  const { preference, setPreference } = useTheme();
  const { user } = useSessionUser();
  const vehicles = useVehicles("active");
  const version = useStoreVersion();
  const monthReadings = useAsync(
    () => readingsRepository.countSince(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    [version],
  );
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    // Deliver what is still local before leaving; the account's data stays on the server.
    if (online) await syncNow().catch(() => undefined);
    await authClient.signOut();
    getStore().reset();
    clearPersistedState();
    router.replace("/login");
  };

  const themeOptions: ReadonlyArray<{ value: ThemePreference; label: string }> = [
    { value: "dark", label: t("profile.themeDark") },
    { value: "light", label: t("profile.themeLight") },
    { value: "auto", label: t("profile.themeAuto") },
  ];

  const syncLabel = !online
    ? t("profile.syncOffline")
    : syncing
      ? t("profile.syncing")
      : queue.length > 0
        ? t("profile.syncPending", { count: queue.length })
        : lastSyncAt
          ? t("profile.syncUpToDate", { time: formatTime(lastSyncAt) })
          : t("profile.syncNever");

  return (
    <>
      {!online && <OfflineBanner pendingCount={queue.length} className="mt-2" />}
      <Screen>
        <header className="flex min-h-14 items-center gap-3.5">
          <Avatar size="lg" className="size-14 bg-surface-2 font-display text-figure-sm font-semibold text-text">
            <Avatar.Fallback>{user?.initials ?? "·"}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate font-display text-card-title font-semibold">{user?.name || user?.email || " "}</h1>
            <div className="truncate text-secondary text-muted">{user?.name ? user.email : t("auth.personalOrg")}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2.5">
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.vehicles")}</div>
            <div className="font-display text-card-title font-semibold">{vehicles.data?.length ?? 0}</div>
          </Card>
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.monthReadings")}</div>
            <div className="font-display text-card-title font-semibold">{monthReadings.data ?? 0}</div>
          </Card>
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.pending")}</div>
            <div className={`font-display text-card-title font-semibold ${queue.length > 0 ? "text-amber-text" : "text-lime-text"}`}>
              {queue.length}
            </div>
          </Card>
        </div>

        <SectionLabel className="mt-1">{t("profile.settings")}</SectionLabel>
        <Card padding="none" className="flex flex-col">
          <SettingsRow
            icon={<Moon className="size-5.5" strokeWidth={2} />}
            label={t("profile.theme")}
            trailing={<Segmented label={t("profile.theme")} value={preference} options={themeOptions} onChange={setPreference} />}
          />
          <SettingsRow
            icon={<RefreshCw className="size-5.5" strokeWidth={2} />}
            label={t("profile.sync")}
            trailing={
              <span className={`flex items-center gap-2 text-secondary font-semibold ${queue.length > 0 || !online ? "text-amber-text" : "text-lime-text"}`}>
                {syncing && <Spinner />}
                {syncLabel}
              </span>
            }
            onPress={online ? () => void syncNow() : undefined}
            last
          />
        </Card>

        <Card padding="none" className="flex flex-col">
          <SettingsRow icon={<Ruler className="size-5.5" strokeWidth={2} />} label={t("profile.units")} trailing={<span className="text-body text-muted">{t("profile.unitsValue")}</span>} />
          <SettingsRow icon={<Globe className="size-5.5" strokeWidth={2} />} label={t("profile.language")} trailing={<span className="text-body text-muted">{t("profile.languageValue")}</span>} last />
        </Card>

        {lastError && (
          <p role="status" className="text-label leading-relaxed text-amber-text">
            {t("sync.lastError", { error: lastError })}
          </p>
        )}
        {queue.length > 0 && <SyncQueueCard entries={queue} online={online} />}

        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="flex h-14 items-center justify-center text-row font-semibold text-red cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:text-muted"
        >
          {signingOut ? t("auth.loggingOut") : t("auth.logout")}
        </button>
      </Screen>
    </>
  );
}
