import { VehicleDetailScreen } from "@/features/vehicles/screens/VehicleDetailScreen";

export default async function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  return <VehicleDetailScreen vehicleId={vehicleId} />;
}
