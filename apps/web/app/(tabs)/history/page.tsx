import { Suspense } from "react";
import { HistoryScreen } from "@/features/readings/screens/HistoryScreen";

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
