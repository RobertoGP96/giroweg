import type { ReactNode } from "react";
import { AppShell } from "@/ui/AppShell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
