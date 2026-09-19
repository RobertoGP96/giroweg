"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { authClient } from "@/auth/client";
import { cn } from "@/lib/cn";
import { Button, FieldLabel, LogoHorizontal, Screen, Spacer } from "@/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign-in and sign-up with Neon Auth email OTP: the address gets a 6-digit
 * code; unknown addresses become new accounts on verification.
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_PATTERN.test(email.trim());

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    const address = email.trim().toLowerCase();
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
    setSending(false);
    if (sendError) {
      setError(t("auth.sendFailed"));
      return;
    }
    router.push(`/login/verify?email=${encodeURIComponent(address)}`);
  };

  return (
    <Screen className="px-6 pt-8 gap-6">
      <LogoHorizontal />
      <div>
        <h1 className="font-display text-auth-title font-bold leading-tight">{t("auth.loginTitle")}</h1>
        <p className="mt-2 text-row text-muted">{t("auth.loginBody")}</p>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldLabel htmlFor={emailId}>{t("auth.emailLabel")}</FieldLabel>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="nombre@empresa.com"
          className={cn(
            "h-15 w-full rounded-lg bg-surface px-4.5 font-display text-card-title font-semibold text-text outline-none placeholder:text-muted",
            focused && "border-2 border-lime",
            error && "border-2 border-amber",
          )}
        />
        {error && (
          <p role="alert" className="text-secondary font-semibold text-amber-text">{error}</p>
        )}
      </form>

      <Spacer />

      <p className="text-center text-label leading-relaxed text-muted">
        <Trans
          i18nKey="auth.terms"
          components={{
            terms: <a href="#terms" className="text-text underline" />,
            privacy: <a href="#privacy" className="text-text underline" />,
          }}
        />
      </p>
      <Button size="md" className="mb-2 h-15 text-button-md" isDisabled={!valid || sending} isPending={sending} onPress={() => void submit()}>
        {sending ? t("auth.sending") : t("auth.sendCode")}
      </Button>
    </Screen>
  );
}
