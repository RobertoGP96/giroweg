"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import { Button, Screen, Spacer, TopBar } from "@/ui";

const LENGTH = 6;
const RESEND_SECONDS = 42;

export function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") ?? "";
  const [digits, setDigits] = useState<string[]>(Array.from({ length: LENGTH }, () => ""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const complete = digits.every((d) => d !== "");

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    // Pasting the whole code into the first box fills every box.
    if (clean.length > 1) {
      const next = Array.from({ length: LENGTH }, (_, i) => clean[i] ?? "");
      setDigits(next);
      inputs.current[Math.min(clean.length, LENGTH) - 1]?.focus();
      return;
    }
    setDigits((prev) => prev.map((d, i) => (i === index ? clean : d)));
    if (clean && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const verify = () => {
    if (complete) router.push("/vehicles");
  };

  return (
    <Screen className="px-6 gap-6">
      <TopBar title="" backHref="/login" className="-ml-3" />
      <div>
        <h1 className="font-display text-auth-title font-bold leading-tight">{t("auth.otpTitle")}</h1>
        <p className="mt-2 text-row text-muted">
          {t("auth.otpBody", { phone })}{" "}
          <Link href="/login" className="text-text underline">
            {t("auth.change")}
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-6 gap-2" role="group" aria-label={t("auth.codeLabel")}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${t("auth.codeLabel")} ${index + 1}`}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus();
            }}
            className={cn(
              "h-16 w-full rounded-control bg-surface text-center font-display text-screen-title font-bold text-text outline-none",
              "focus:border-2 focus:border-lime",
            )}
          />
        ))}
      </div>

      <p className="text-body text-muted">
        {seconds > 0 ? (
          <>
            {t("auth.resendIn")}{" "}
            <span className="font-display font-semibold text-text">{formatElapsed(seconds)}</span>
          </>
        ) : (
          <button type="button" onClick={() => setSeconds(RESEND_SECONDS)} className="text-text underline cursor-pointer">
            {t("auth.resend")}
          </button>
        )}
      </p>

      <Spacer />
      <Button size="md" className="mb-2 h-15 text-button-md" isDisabled={!complete} onPress={verify}>
        {t("auth.verify")}
      </Button>
    </Screen>
  );
}
