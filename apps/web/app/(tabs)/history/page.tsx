import { Suspense } from "react";
import { HistoryScreen } from "@/features/trips/screens/HistoryScreen";

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
