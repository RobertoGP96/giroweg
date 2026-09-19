import { TripDetailScreen } from "@/features/trips/screens/TripDetailScreen";

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripDetailScreen tripId={tripId} />;
}
