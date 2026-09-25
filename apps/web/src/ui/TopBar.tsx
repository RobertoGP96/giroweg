"use client";

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "./Button";
import { cn } from "@/lib/cn";
import { useNavigate } from "./navigation";

interface TopBarProps {
  title: string;
  /** Where "back" leads when the previous history entry is not the app's. */
  backHref?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  /** Large 28 px title (tab roots) instead of the 20 px inner-screen title. */
  large?: boolean;
  className?: string;
}

export function TopBar({ title, backHref, onBack, trailing, large = false, className }: TopBarProps) {
  const { t } = useTranslation();
  const { back, pending } = useNavigate();
  const showBack = Boolean(backHref || onBack);

  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return back(backHref);
  };

  return (
    <header className={cn("flex min-h-14 items-center gap-2", showBack && "-ml-4", className)}>
      {showBack && (
        <IconButton label={t("common.back")} onPress={handleBack} isPending={pending}>
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
