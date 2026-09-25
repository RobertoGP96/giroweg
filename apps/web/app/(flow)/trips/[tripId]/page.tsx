import { Suspense } from "react";
import { TripDetailScreen } from "@/features/trips/screens/TripDetailScreen";

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return (
    <Suspense>
      <TripDetailScreen tripId={tripId} />
    </Suspense>
  );
}
