import type { ReactNode } from "react";
import { AppShell } from "@/ui/AppShell";
import { BottomNav } from "@/ui/BottomNav";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      {children}
      <BottomNav />
    </AppShell>
  );
}
