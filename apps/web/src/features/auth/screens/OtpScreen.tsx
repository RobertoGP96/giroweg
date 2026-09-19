"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/auth/client";
import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import { Button, Screen, Spacer, TopBar } from "@/ui";
import { completeSignIn } from "../completeSignIn";

const LENGTH = 6;
const RESEND_SECONDS = 42;

export function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [digits, setDigits] = useState<string[]>(Array.from({ length: LENGTH }, () => ""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const complete = digits.every((d) => d !== "");

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    setNotice(null);
    // Pasting the whole code into the first box fills every box.
    if (clean.length > 1) {
      setDigits(Array.from({ length: LENGTH }, (_, i) => clean[i] ?? ""));
      inputs.current[Math.min(clean.length, LENGTH) - 1]?.focus();
      return;
    }
    setDigits((prev) => prev.map((d, i) => (i === index ? clean : d)));
    if (clean && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const verify = async () => {
    if (!complete || verifying || !email) return;
    setVerifying(true);
    setNotice(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: digits.join("") });
    if (error) {
      setVerifying(false);
      setNotice({ tone: "error", text: t("auth.verifyFailed") });
      setDigits(Array.from({ length: LENGTH }, () => ""));
      inputs.current[0]?.focus();
      return;
    }
    const next = await completeSignIn();
    router.replace(next);
  };

  const resend = async () => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setNotice(error ? { tone: "error", text: t("auth.sendFailed") } : { tone: "info", text: t("auth.resent") });
    if (!error) setSeconds(RESEND_SECONDS);
  };

  return (
    <Screen className="px-6 gap-6">
      <TopBar title="" backHref="/login" className="-ml-3" />
      <div>
        <h1 className="font-display text-auth-title font-bold leading-tight">{t("auth.otpTitle")}</h1>
        <p className="mt-2 text-row text-muted">
          {t("auth.otpBody", { email })}{" "}
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
            disabled={verifying}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus();
              if (event.key === "Enter") void verify();
            }}
            className={cn(
              "h-16 w-full rounded-control bg-surface text-center font-display text-screen-title font-bold text-text outline-none",
              "focus:border-2 focus:border-lime",
              notice?.tone === "error" && "border-2 border-amber",
            )}
          />
        ))}
      </div>

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={cn("text-secondary font-semibold", notice.tone === "error" ? "text-amber-text" : "text-lime-text")}>
          {notice.text}
        </p>
      )}

      <p className="text-body text-muted">
        {seconds > 0 ? (
          <>
            {t("auth.resendIn")}{" "}
            <span className="font-display font-semibold text-text">{formatElapsed(seconds)}</span>
          </>
        ) : (
          <button type="button" onClick={() => void resend()} className="text-text underline cursor-pointer">
            {t("auth.resend")}
          </button>
        )}
      </p>

      <Spacer />
      <Button size="md" className="mb-2 h-15 text-button-md" isDisabled={!complete || verifying} isPending={verifying} onPress={() => void verify()}>
        {verifying ? t("auth.verifying") : t("auth.verify")}
      </Button>
    </Screen>
  );
}
