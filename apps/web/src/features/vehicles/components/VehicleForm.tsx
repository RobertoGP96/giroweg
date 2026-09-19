"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UNITS } from "@giroweg/shared/domain";
import {
  vehicleFormSchema,
  type Vehicle,
  type VehicleFormOutput,
  type VehicleFormValues,
} from "@giroweg/shared/schemas";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { formatInputNumber } from "@/lib/format";
import { Button, SegmentedField, TextInput } from "@/ui";
import { UnitLockedError } from "../repository";
import { VehicleTypePicker } from "./VehicleTypePicker";

interface VehicleFormProps {
  /** Vehicle being edited; omitted when creating. */
  vehicle?: Vehicle | undefined;
  /** Domain rule 3: the unit cannot change once there are readings. */
  unitLocked: boolean;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (input: VehicleFormOutput) => Promise<void>;
}

const toValues = (vehicle: Vehicle | undefined): VehicleFormValues => ({
  type: vehicle?.type ?? "car",
  name: vehicle?.name ?? "",
  brand: vehicle?.brand ?? "",
  model: vehicle?.model ?? "",
  year: vehicle?.year === null || vehicle?.year === undefined ? "" : String(vehicle.year),
  plate: vehicle?.plate ?? "",
  unit: vehicle?.unit ?? "km",
  initialValue: vehicle ? formatInputNumber(vehicle.initialValue) : "",
});

/** Vehicle form (react-hook-form + the shared zod schema). */
export function VehicleForm({ vehicle, unitLocked, submitLabel, disabled = false, onSubmit }: VehicleFormProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues, unknown, VehicleFormOutput>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: toValues(vehicle),
  });

  const messageFor = (field: keyof VehicleFormValues): string | undefined => {
    const message = errors[field]?.message;
    if (!message) return undefined;
    return t(`vehicles.form.errors.${message}`, { defaultValue: t("vehicles.form.errors.invalid") });
  };

  const submit = handleSubmit(async (input) => {
    try {
      await onSubmit(input);
    } catch (cause) {
      if (cause instanceof UnitLockedError) setError("unit", { message: "unitLocked" });
      else setError("root", { message: cause instanceof Error && cause.name === "NoSessionError" ? "noSession" : "save" });
    }
  });

  const unitOptions = UNITS.map((unit) => ({ value: unit, label: t(`vehicles.form.units.${unit}`) }));

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Controller
        name="type"
        control={control}
        render={({ field }) => <VehicleTypePicker label={t("vehicles.form.type")} value={field.value} onChange={field.onChange} />}
      />
      <TextInput
        label={t("vehicles.form.name")}
        placeholder={t("vehicles.form.namePlaceholder")}
        autoComplete="off"
        error={messageFor("name")}
        {...register("name")}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("vehicles.form.brand")} autoComplete="off" error={messageFor("brand")} {...register("brand")} />
        <TextInput label={t("vehicles.form.model")} autoComplete="off" error={messageFor("model")} {...register("model")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label={t("vehicles.form.year")}
          inputMode="numeric"
          autoComplete="off"
          placeholder={String(new Date().getFullYear())}
          error={messageFor("year")}
          {...register("year")}
        />
        <TextInput
          label={t("vehicles.form.plate")}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder={t("vehicles.form.platePlaceholder")}
          error={messageFor("plate")}
          {...register("plate")}
        />
      </div>
      <Controller
        name="unit"
        control={control}
        render={({ field }) => (
          <SegmentedField
            label={t("vehicles.form.unit")}
            value={field.value}
            options={unitOptions}
            onChange={field.onChange}
            disabled={unitLocked}
            error={messageFor("unit")}
            hint={unitLocked ? t("vehicles.form.unitLocked") : t("vehicles.form.unitHint")}
          />
        )}
      />
      <TextInput
        label={t("vehicles.form.initialValue")}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        hint={t("vehicles.form.initialValueHint")}
        error={messageFor("initialValue")}
        {...register("initialValue")}
      />

      {errors.root?.message && (
        <p role="alert" className="text-secondary font-semibold text-amber-text">
          {t(`vehicles.form.errors.${errors.root.message}`)}
        </p>
      )}

      <div className="flex-1" aria-hidden />
      <Button type="submit" size="lg" isDisabled={disabled || isSubmitting} isPending={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
