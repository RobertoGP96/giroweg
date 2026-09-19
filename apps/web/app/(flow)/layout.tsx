import type { ReactNode } from "react";
import { AppShell } from "@/ui/AppShell";

/** Full-screen flows without the tab bar: shift, trip detail, maintenance. */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
