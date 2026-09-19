"use client";

import { Check, Flag, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatElapsed, formatNumber } from "@/lib/format";
import { Button, Card, Ring } from "@/ui";
import { RouteMap } from "../components/RouteMap";
import { useTripTracker } from "../hooks/useTripTracker";
import { PLANNED_DISTANCE_KM, PLANNED_STOPS } from "../plan";
import { useShiftStore } from "../store";

export function TripScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const step = useShiftStore((s) => s.step);
  const km = useShiftStore((s) => s.gpsDistance);
  const seconds = useShiftStore((s) => s.elapsedSeconds);
  const stops = useShiftStore((s) => s.stops);
  const paused = useShiftStore((s) => s.paused);
  const speed = useShiftStore((s) => s.speed);
  const addStop = useShiftStore((s) => s.addStop);
  const togglePause = useShiftStore((s) => s.togglePause);
  const beginEnd = useShiftStore((s) => s.beginEnd);

  useTripTracker(step === "trip");

  // Without a shift in progress this screen has nothing to show.
  useEffect(() => {
    if (step === "idle") router.replace("/home");
    else router.prefetch("/shift/end");
  }, [step, router]);

  const progress = Math.min(km / PLANNED_DISTANCE_KM, 1);

  const finish = () => {
    beginEnd();
    router.push("/shift/end");
  };

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <RouteMap progress={progress} />

      <div className="relative flex justify-center pt-1.5">
        <Ring value={progress} paused={paused} label={t("shift.kmTravelled")}>
          <div className="font-display text-ring font-bold leading-none tracking-tight">{formatNumber(km)}</div>
          <div className="mt-1 font-display text-body font-semibold text-muted">
            {paused ? t("shift.paused") : t("shift.kmTravelled")}
          </div>
        </Ring>
      </div>

      <div className="relative mx-screen mt-2 flex gap-2.5">
        <Card padding="none" className="flex-1 px-3.5 py-3">
          <div className="text-label text-muted">{t("shift.time")}</div>
          <div className="font-display text-stat font-semibold">{formatElapsed(seconds)}</div>
        </Card>
        <Card padding="none" className="flex-1 px-3.5 py-3">
          <div className="text-label text-muted">{t("shift.deliveries")}</div>
          <div className="font-display text-stat font-semibold">
            {stops}
            <span className="text-body-lg text-muted">/{PLANNED_STOPS}</span>
          </div>
        </Card>
        <Card padding="none" className="flex-1 px-3.5 py-3">
          <div className="text-label text-muted">{t("shift.speed")}</div>
          <div className="font-display text-stat font-semibold">
            {paused ? 0 : speed}
            <span className="text-secondary text-muted"> {t("common.kmPerHour")}</span>
          </div>
        </Card>
      </div>

      <div className="flex-1" aria-hidden />

      <section className="relative flex flex-col gap-3 rounded-t-sheet bg-bg px-screen pt-4 pb-7 shadow-sheet">
        <div className="mx-auto -mb-1 h-1 w-10 rounded-full bg-surface-2" aria-hidden />
        <div className="flex items-center justify-between text-body">
          <span className="text-muted">{t("shift.nextStop")}</span>
          <span className="font-semibold">Av. Insurgentes 1420 · 1,4 km</span>
        </div>
        <Button variant="secondary" size="md" onPress={addStop} className="bg-surface text-body-lg shadow-card">
          <Check className="size-5 text-lime-text" strokeWidth={2.4} aria-hidden />
          {t("shift.markDelivery")}
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onPress={togglePause} className="flex-1 text-button">
            {paused ? (
              <Play className="size-5" strokeWidth={2.4} aria-hidden />
            ) : (
              <Pause className="size-5" strokeWidth={2.4} aria-hidden />
            )}
            {paused ? t("shift.resume") : t("shift.pause")}
          </Button>
          <Button size="lg" onPress={finish} className="flex-[1.3] text-button">
            <Flag className="size-5" strokeWidth={2.4} aria-hidden />
            {t("shift.finish")}
          </Button>
        </div>
      </section>
    </main>
  );
}
