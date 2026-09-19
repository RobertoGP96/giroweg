"use client";

import { Avatar } from "@heroui/react";
import { Bell, Camera, MapPin, Moon, RefreshCw, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/auth/client";
import { useSessionUser } from "@/auth/useSessionUser";
import { currentUser } from "@/db/seed";
import { formatNumber, formatOdometer, formatTime } from "@/lib/format";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { dayKey, useTrips } from "@/features/trips/hooks/useTrips";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Card, OfflineBanner, Screen, SectionLabel, Segmented, SettingsRow, Toggle } from "@/ui";

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useOnlineStatus();
  const { preference, setPreference } = useTheme();
  const active = useActiveVehicle();
  const trips = useTrips(active.data?.vehicle.id);
  const { user } = useSessionUser();
  const [backgroundGps, setBackgroundGps] = useState(true);
  const [autoOdometer, setAutoOdometer] = useState(true);
  const [reminders, setReminders] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
  };

  const month = dayKey(new Date().toISOString()).slice(0, 7);
  const monthTrips = (trips.data ?? []).filter((trip) => dayKey(trip.trip.startedAt).startsWith(month));
  const monthDistance = monthTrips.reduce((sum, trip) => sum + trip.distance, 0);
  const withGps = monthTrips.filter((trip) => trip.gps !== null);
  const accuracy = withGps.length > 0 ? withGps.filter((trip) => !trip.needsReview).length / withGps.length : 1;
  const lastSync = trips.data?.[0]?.trip.endedAt;

  const themeOptions: ReadonlyArray<{ value: ThemePreference; label: string }> = [
    { value: "dark", label: t("profile.themeDark") },
    { value: "light", label: t("profile.themeLight") },
    { value: "auto", label: t("profile.themeAuto") },
  ];

  return (
    <>
      {!online && <OfflineBanner pendingCount={3} className="mt-2" />}
      <Screen>
        <header className="flex min-h-14 items-center gap-3.5">
          <Avatar size="lg" className="size-14 bg-surface-2 font-display text-figure-sm font-semibold text-text">
            <Avatar.Fallback>{user?.initials ?? "·"}</Avatar.Fallback>
          </Avatar>
          <div>
            <h1 className="font-display text-card-title font-semibold">{user?.name || user?.email || " "}</h1>
            <div className="text-secondary text-muted">
              {user?.email && user.name ? user.email : t("profile.role", { role: currentUser.role, fleet: currentUser.fleet })}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2.5">
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.thisMonth")}</div>
            <div className="font-display text-card-title font-semibold">
              {formatOdometer(monthDistance)} <span className="text-nav text-muted">{active.data?.vehicle.unit ?? "km"}</span>
            </div>
          </Card>
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.shifts")}</div>
            <div className="font-display text-card-title font-semibold">{monthTrips.length}</div>
          </Card>
          <Card padding="none" className="px-3.5 py-3">
            <div className="text-nav text-muted">{t("profile.accuracy")}</div>
            <div className="font-display text-card-title font-semibold text-lime-text">{formatNumber(accuracy * 100, 0)} %</div>
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
            icon={<MapPin className="size-5.5" strokeWidth={2} />}
            label={t("profile.backgroundGps")}
            trailing={<Toggle label={t("profile.backgroundGps")} isSelected={backgroundGps} onChange={setBackgroundGps} />}
          />
          <SettingsRow
            icon={<Camera className="size-5.5" strokeWidth={2} />}
            label={t("profile.autoOdometer")}
            trailing={<Toggle label={t("profile.autoOdometer")} isSelected={autoOdometer} onChange={setAutoOdometer} />}
          />
          <SettingsRow
            icon={<Bell className="size-5.5" strokeWidth={2} />}
            label={t("profile.maintenanceReminders")}
            trailing={<Toggle label={t("profile.maintenanceReminders")} isSelected={reminders} onChange={setReminders} />}
          />
          <SettingsRow
            icon={<RefreshCw className="size-5.5" strokeWidth={2} />}
            label={t("profile.sync")}
            trailing={
              <span className="text-secondary font-semibold text-lime-text">
                {t("profile.syncUpToDate", { time: lastSync ? formatTime(lastSync) : "—" })}
              </span>
            }
            last
          />
        </Card>

        <Card padding="none" className="flex flex-col">
          <SettingsRow label={t("profile.units")} trailing={<span className="text-body text-muted">{t("profile.unitsValue")}</span>} />
          <SettingsRow label={t("profile.language")} trailing={<span className="text-body text-muted">{t("profile.languageValue")}</span>} />
          <SettingsRow
            icon={<Wrench className="size-5.5" strokeWidth={2} />}
            label={t("profile.maintenance")}
            onPress={() => router.push("/maintenance")}
            last
          />
        </Card>

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
