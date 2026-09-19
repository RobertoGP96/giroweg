"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button, FieldLabel, LogoHorizontal, Screen, Spacer } from "@/ui";

const COUNTRY_CODES = ["+52", "+1", "+34", "+57", "+54"] as const;

/** Groups digits as 55 4021 8837 while typing. */
const formatPhone = (digits: string): string =>
  digits
    .slice(0, 10)
    .replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a: string, b: string, c: string) =>
      [a, b, c].filter(Boolean).join(" "),
    );

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const phoneId = useId();
  const codeId = useId();
  const [code, setCode] = useState<string>(COUNTRY_CODES[0]);
  const [digits, setDigits] = useState("");
  const [focused, setFocused] = useState(false);
  const valid = digits.length === 10;

  const submit = () => {
    if (!valid) return;
    const phone = `${code} ${formatPhone(digits)}`;
    router.push(`/login/verify?phone=${encodeURIComponent(phone)}`);
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
          submit();
        }}
      >
        <FieldLabel htmlFor={phoneId}>{t("auth.phoneLabel")}</FieldLabel>
        <div className="flex gap-2.5">
          <div className="relative">
            <label htmlFor={codeId} className="sr-only">
              {t("auth.countryCode")}
            </label>
            <select
              id={codeId}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="h-15 appearance-none rounded-lg bg-surface pr-9 pl-4 font-display text-button font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={formatPhone(digits)}
            onChange={(event) => setDigits(event.target.value.replace(/\D/g, ""))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="55 0000 0000"
            className={cn(
              "h-15 min-w-0 flex-1 rounded-lg bg-surface px-4.5 font-display text-card-title font-semibold text-text outline-none placeholder:text-muted",
              focused && "border-2 border-lime",
            )}
          />
        </div>
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
      <Button size="md" className="mb-2 h-15 text-button-md" isDisabled={!valid} onPress={submit}>
        {t("auth.sendCode")}
      </Button>
    </Screen>
  );
}
