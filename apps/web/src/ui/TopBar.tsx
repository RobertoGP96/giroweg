"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "./Button";
import { cn } from "@/lib/cn";

interface TopBarProps {
  title: string;
  /** Route to go back to; falls back to browser history. */
  backHref?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  /** Large 28 px title (tab roots) instead of the 20 px inner-screen title. */
  large?: boolean;
  className?: string;
}

export function TopBar({ title, backHref, onBack, trailing, large = false, className }: TopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const showBack = Boolean(backHref || onBack);

  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
  };

  return (
    <header className={cn("flex min-h-14 items-center gap-2", showBack && "-ml-4", className)}>
      {showBack && (
        <IconButton label={t("common.back")} onPress={handleBack}>
          <ChevronLeft className="size-6" strokeWidth={2} />
        </IconButton>
      )}
      <h1
        className={cn(
          "font-display font-semibold",
          large ? "text-screen-title font-bold" : "text-card-title",
        )}
      >
        {title}
      </h1>
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </header>
  );
}
