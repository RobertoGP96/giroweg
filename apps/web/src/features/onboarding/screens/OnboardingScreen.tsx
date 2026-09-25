"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatOdometerDistance } from "@/lib/format";
import { Button, Card, LogoMark, Screen, useNavigate } from "@/ui";

const STEPS = ["step1", "step2", "step3"] as const;

export function OnboardingScreen() {
  const { t } = useTranslation();
  const { push, pending } = useNavigate();
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? "step1";
  const last = index === STEPS.length - 1;

  const finish = () => push("/login");
  const next = () => (last ? finish() : setIndex(index + 1));

  return (
    <Screen className="px-0 pt-0">
      <div className="flex justify-end px-6">
        {!last ? (
          <button
            type="button"
            onClick={finish}
            className="flex h-11 items-center text-body text-muted cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-lime rounded-sm"
          >
            {t("common.skip")}
          </button>
        ) : (
          <div className="h-11" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8">
        <Illustration step={step} />
        <div className="text-center">
          <h1 className="whitespace-pre-line font-display text-onboarding font-bold leading-tight tracking-tight">
            {t(`onboarding.${step}Title`)}
          </h1>
          <p className="mt-3 text-body-lg leading-relaxed text-muted text-pretty">
            {t(`onboarding.${step}Body`)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-screen pb-9">
        <div className="flex justify-center gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn("h-1.5 rounded-full", i === index ? "w-6 bg-lime" : "w-1.5 bg-surface-2")}
            />
          ))}
        </div>
        <Button size="md" onPress={next} isPending={pending} className="h-15 text-button-md">
          {last ? t("common.start") : t("common.next")}
        </Button>
      </div>
    </Screen>
  );
}

/** Decorative previews of the product; figures are illustrative only. */
function Illustration({ step }: { step: (typeof STEPS)[number] }) {
  if (step === "step1") {
    return <LogoMark size={140} className="text-lime" />;
  }
  if (step === "step2") {
    return (
      <div className="flex h-27.5 w-62.5 items-center justify-center rounded-md border-2 border-lime bg-surface font-display text-dial font-bold tracking-dial">
        034218
      </div>
    );
  }
  const rows = [
    { label: "Lun 14", value: 34_132, delta: 86 },
    { label: "Mar 15", value: 34_218, delta: 86 },
    { label: "Mié 16", value: 34_301, delta: 83 },
  ];
  return (
    <div className="flex w-full flex-col gap-2.5" aria-hidden>
      {rows.map((row) => (
        <Card key={row.label} className="flex items-center justify-between">
          <span className="text-body text-muted">{row.label}</span>
          <span className="font-display text-figure-sm font-semibold">
            {formatOdometerDistance(row.value, "km")}{" "}
            <span className="text-secondary text-lime-text">+{row.delta}</span>
          </span>
        </Card>
      ))}
    </div>
  );
}
