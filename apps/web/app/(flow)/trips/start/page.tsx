import { Suspense } from "react";
import { TripStartScreen } from "@/features/trips/screens/TripStartScreen";

export default function TripStartPage() {
  return (
    <Suspense>
      <TripStartScreen />
    </Suspense>
  );
}
