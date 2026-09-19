import type { ReactNode } from "react";
import { PageTransition } from "@/ui/PageTransition";

export default function AuthTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
