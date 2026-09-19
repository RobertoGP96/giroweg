import { Suspense } from "react";
import { NewReadingScreen } from "@/features/readings/screens/NewReadingScreen";

export default function NewReadingPage() {
  return (
    <Suspense>
      <NewReadingScreen />
    </Suspense>
  );
}
