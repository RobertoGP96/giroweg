import type { ReactNode } from "react";
import { PageTransition } from "@/ui/PageTransition";

export default function TabsTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
