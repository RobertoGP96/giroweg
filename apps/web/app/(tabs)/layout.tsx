import type { ReactNode } from "react";
import { AppShell } from "@/ui/AppShell";
import { BottomNav } from "@/ui/BottomNav";

/** Tab roots: the floating tab bar is fixed, so content reserves room under it. */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(var(--spacing-nav-clearance)+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </AppShell>
  );
}
