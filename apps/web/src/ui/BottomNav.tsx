"use client";

import { Car, Clock, Home, Plus, User, type LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { navOptions } from "./navigation";

const TABS = [
  { href: "/home", key: "nav.home", Icon: Home },
  { href: "/vehicles", key: "nav.vehicles", Icon: Car },
  { href: "/history", key: "nav.history", Icon: Clock },
  { href: "/profile", key: "nav.profile", Icon: User },
] as const;

/**
 * Floating tab bar: a translucent, blurred pill detached from the screen
 * edges with the primary action (new reading) raised in the middle. Fixed
 * to the viewport, so screens under it reserve `pb-nav-clearance`. Tabs
 * cross-fade between each other; the action pushes a flow screen. A tab
 * lights up as soon as it is pressed, before its screen arrives.
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
      <div className="pointer-events-auto flex h-nav-height w-full max-w-nav items-center gap-1 rounded-full border border-line bg-surface/85 p-1.5 shadow-nav backdrop-blur-xl">
        {TABS.slice(0, 2).map((tab) => (
          <Tab key={tab.href} href={tab.href} label={t(tab.key)} Icon={tab.Icon} active={isActive(tab.href)} />
        ))}
        <Link
          href="/readings/new"
          aria-label={t("nav.newReading")}
          {...navOptions("forward")}
          className={cn(
            "mx-0.5 flex size-13 shrink-0 items-center justify-center rounded-full bg-lime text-ink shadow-fab",
            "transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
            "outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          )}
        >
          <ActionIcon />
        </Link>
        {TABS.slice(2).map((tab) => (
          <Tab key={tab.href} href={tab.href} label={t(tab.key)} Icon={tab.Icon} active={isActive(tab.href)} />
        ))}
      </div>
    </nav>
  );
}

/** The plus turns while the new-reading screen is on its way. */
function ActionIcon() {
  const { pending } = useLinkStatus();
  return (
    <Plus
      className={cn("size-6.5 transition-transform duration-200 motion-reduce:transition-none", pending && "rotate-90")}
      strokeWidth={2.6}
      aria-hidden
    />
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
      {...navOptions("tab")}
      className={cn(
        "flex h-full min-w-0 flex-1 rounded-full",
        "transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime",
      )}
    >
      <TabBody label={label} Icon={Icon} active={active} />
    </Link>
  );
}

/** Inside the Link so it can show the pending state of that navigation. */
function TabBody({ label, Icon, active }: Omit<TabProps, "href">) {
  const { pending } = useLinkStatus();
  // The pending look waits 100 ms so an instant navigation does not flash it.
  const lit = active || pending;
  return (
    <span
      className={cn(
        "flex size-full flex-col items-center justify-center gap-0.5 rounded-full text-nav",
        "transition-[background-color,color] duration-150 motion-reduce:transition-none",
        lit ? "bg-surface-2 font-semibold text-lime-text" : "font-medium text-muted",
        pending && !active && "delay-100",
      )}
    >
      <Icon className="size-5.5" strokeWidth={lit ? 2.4 : 2} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
