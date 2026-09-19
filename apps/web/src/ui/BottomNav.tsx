"use client";

import { Car, Clock, Home, Plus, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/home", key: "nav.home", Icon: Home },
  { href: "/vehicles", key: "nav.vehicles", Icon: Car },
  { href: "/history", key: "nav.history", Icon: Clock },
  { href: "/profile", key: "nav.profile", Icon: User },
] as const;

/**
 * Floating tab bar: a translucent, blurred pill detached from the screen
 * edges with the primary action (new reading) raised in the middle. Fixed
 * to the viewport, so screens under it reserve `pb-nav-clearance`.
 */
export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={t("nav.label")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-screen pb-[calc(env(safe-area-inset-bottom)+var(--spacing-nav-offset))]"
    >
      <div className="pointer-events-auto flex h-nav w-full max-w-nav items-center gap-1 rounded-full border border-line bg-surface/85 p-1.5 shadow-nav backdrop-blur-xl">
        {TABS.slice(0, 2).map((tab) => (
          <Tab key={tab.href} href={tab.href} label={t(tab.key)} Icon={tab.Icon} active={isActive(tab.href)} />
        ))}
        <Link
          href="/readings/new"
          aria-label={t("nav.newReading")}
          className={cn(
            "mx-0.5 flex size-13 shrink-0 items-center justify-center rounded-full bg-lime text-ink shadow-fab",
            "transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
            "outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          )}
        >
          <Plus className="size-6.5" strokeWidth={2.6} aria-hidden />
        </Link>
        {TABS.slice(2).map((tab) => (
          <Tab key={tab.href} href={tab.href} label={t(tab.key)} Icon={tab.Icon} active={isActive(tab.href)} />
        ))}
      </div>
    </nav>
  );
}

interface TabProps {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}

function Tab({ href, label, Icon, active }: TabProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-nav",
        "transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime",
        active ? "bg-surface-2 font-semibold text-lime-text" : "font-medium text-muted",
      )}
    >
      <Icon className="size-5.5" strokeWidth={active ? 2.4 : 2} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
