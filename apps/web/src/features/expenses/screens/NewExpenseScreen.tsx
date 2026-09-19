"use client";

import { costPerDistance, fuelEfficiency } from "@giroweg/shared/domain";
import type { ExpenseType } from "@giroweg/shared/schemas";
import { Fuel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { nowIso } from "@/lib/id";
import { formatMoney, formatNumber, formatOdometer } from "@/lib/format";
import { useOnlineStatus } from "@/features/sync/hooks/useOnlineStatus";
import { useActiveVehicle } from "@/features/vehicles/hooks/useVehicles";
import { Button, Card, ErrorState, FilterChip, ListSkeleton, OfflineBanner, Screen, Spacer, TopBar } from "@/ui";
import { expensesRepository } from "../repository";

const TYPES: ExpenseType[] = ["fuel", "toll", "other"];
const CURRENCY = "MXN";

/** Distance covered since the previous fuel-up, used for the estimate. Demo value until expenses are linked to readings. */
const DISTANCE_SINCE_LAST_FUEL_KM = 543;

export function NewExpenseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useOnlineStatus();
  const active = useActiveVehicle();
  const amountId = useId();
  const litresId = useId();
  const [type, setType] = useState<ExpenseType>("fuel");
  const [amount, setAmount] = useState<string>("412.50");
  const [litres, setLitres] = useState<string>("17.4");
  const [saving, setSaving] = useState(false);

  const vehicle = active.data?.vehicle;
  const odometer = active.data?.odometer ?? 0;
  const amountValue = Number(amount) || 0;
  const litresValue = Number(litres) || 0;
  const kmPerLitre = fuelEfficiency(DISTANCE_SINCE_LAST_FUEL_KM, litresValue);
  const costPerKm = costPerDistance(amountValue, DISTANCE_SINCE_LAST_FUEL_KM);

  const save = async () => {
    if (!vehicle || amountValue <= 0) return;
    setSaving(true);
    try {
      await expensesRepository.add({
        vehicleId: vehicle.id,
        type,
        amount: amountValue,
        currency: CURRENCY,
        litres: type === "fuel" ? litresValue : null,
        readingId: null,
        note: null,
        occurredAt: nowIso(),
      });
      router.push("/home");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!online && <OfflineBanner pendingCount={3} className="mt-2" />}
      <Screen className="pt-1">
        <TopBar title={t("expenses.title")} backHref="/home" />

        <div className="flex gap-2" role="radiogroup" aria-label={t("expenses.title")}>
          {TYPES.map((option) => (
            <FilterChip key={option} selected={type === option} onClick={() => setType(option)} className="h-11" role="radio" aria-checked={type === option}>
              {option === "fuel" && <Fuel className="size-4" strokeWidth={2.2} aria-hidden />}
              {t(`expenses.${option}`)}
            </FilterChip>
          ))}
        </div>

        {active.status === "loading" && <ListSkeleton />}
        {active.status === "error" && <ErrorState onRetry={active.reload} />}

        {active.status === "success" && (
          <>
            <div className="flex h-37.5 items-center justify-center gap-3 rounded-lg bg-surface-2 text-secondary text-muted">
              <div className="flex h-29.5 w-24 -rotate-3 flex-col gap-1.5 rounded-sm bg-surface p-2.5 shadow-card" aria-hidden>
                <span className="h-1.5 w-3/5 rounded-full bg-track" />
                <span className="h-1.25 w-11/12 rounded-full bg-track" />
                <span className="h-1.25 w-4/5 rounded-full bg-track" />
                <span className="h-1.25 w-5/6 rounded-full bg-track" />
                <span className="mt-auto h-2 w-1/2 rounded-full bg-lime" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-lime-text">{t("expenses.receiptRead")}</span>
                <span>Pemex · Av. Universidad</span>
                <span>18 sep · 08:40</span>
              </div>
            </div>

            <Card tone="selected" className="flex items-center justify-between px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <label htmlFor={amountId} className="text-label text-muted">{t("expenses.amount")}</label>
                <div className="flex items-baseline font-display text-dial-sm font-bold leading-tight">
                  <span aria-hidden>$ </span>
                  <input
                    id={amountId}
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                    className="w-full min-w-0 bg-transparent outline-none"
                  />
                </div>
              </div>
              <span className="font-display text-body-lg font-semibold text-muted">{CURRENCY}</span>
            </Card>

            <div className="grid grid-cols-2 gap-2.5">
              <Card className={cn(type !== "fuel" && "opacity-50")}>
                <label htmlFor={litresId} className="text-label text-muted">{t("expenses.litres")}</label>
                <input
                  id={litresId}
                  inputMode="decimal"
                  disabled={type !== "fuel"}
                  value={litres}
                  onChange={(event) => setLitres(event.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-0.5 w-full bg-transparent font-display text-stat font-semibold outline-none"
                />
              </Card>
              <Card>
                <div className="text-label text-muted">{t("expenses.odometer")}</div>
                <div className="mt-0.5 font-display text-stat font-semibold">{formatOdometer(odometer)}</div>
              </Card>
            </div>

            {type === "fuel" && kmPerLitre !== null && costPerKm !== null && (
              <div className="flex justify-between px-1 text-secondary text-muted">
                <span>{t("expenses.efficiency")}</span>
                <span className="font-display text-body font-semibold text-text">
                  {t("expenses.efficiencyValue", {
                    kmPerLitre: formatNumber(kmPerLitre),
                    costPerKm: formatMoney(costPerKm, CURRENCY),
                  })}
                </span>
              </div>
            )}
          </>
        )}

        <Spacer />
        <Button size="lg" className="mb-5" isDisabled={amountValue <= 0 || saving} isPending={saving} onPress={save}>
          {t("expenses.save")}
        </Button>
      </Screen>
    </>
  );
}
