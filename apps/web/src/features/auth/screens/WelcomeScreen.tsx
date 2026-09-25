"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/auth/client";
import { cn } from "@/lib/cn";
import { Button, FieldLabel, LogoHorizontal, Screen, Spacer, useNavigate } from "@/ui";

/** First sign-in: capture the driver's name (Neon Auth user profile). */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const { replace, pending } = useNavigate();
  const nameId = useId();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await authClient.updateUser({ name: name.trim() });
    setSaving(false);
    if (updateError) {
      setError(t("states.errorTitle"));
      return;
    }
    replace("/home", "forward");
  };

  return (
    <Screen className="px-6 pt-8 gap-6">
      <LogoHorizontal />
      <div>
        <h1 className="font-display text-auth-title font-bold leading-tight">{t("auth.welcomeTitle")}</h1>
        <p className="mt-2 text-row text-muted">{t("auth.welcomeBody")}</p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FieldLabel htmlFor={nameId}>{t("auth.nameLabel")}</FieldLabel>
        <input
          id={nameId}
          type="text"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={cn(
            "h-15 w-full rounded-lg border-2 border-lime bg-surface px-4.5 font-display text-card-title font-semibold text-text outline-none placeholder:text-muted",
            error && "border-amber",
          )}
        />
        {error && <p role="alert" className="text-secondary font-semibold text-amber-text">{error}</p>}
      </form>
      <Spacer />
      <Button size="md" className="mb-2 h-15 text-button-md" isDisabled={!valid || saving || pending} isPending={saving || pending} onPress={() => void save()}>
        {t("auth.saveName")}
      </Button>
    </Screen>
  );
}
