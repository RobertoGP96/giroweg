"use client";

import { Clock, Home, Receipt, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/home", key: "nav.home", Icon: Home },
  { href: "/history", key: "nav.history", Icon: Clock },
  { href: "/expenses", key: "nav.expenses", Icon: Receipt },
  { href: "/profile", key: "nav.profile", Icon: User },
] as const;

/** 84 px tab bar. Active tab in lime-text, others muted. */
export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.home")}
      className="sticky bottom-0 flex h-21 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, key, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 pb-4 text-nav",
              "transition-[color,transform] duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
              "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime",
              active ? "font-semibold text-lime-text" : "font-medium text-muted",
            )}
          >
            <Icon className="size-6" strokeWidth={2} aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
