import type { ReactNode } from "react";
import { AppShell } from "@/ui/AppShell";

/** Full-screen flows without the tab bar: vehicle forms and details, readings. */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
