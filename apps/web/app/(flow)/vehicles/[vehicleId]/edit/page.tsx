import { VehicleFormScreen } from "@/features/vehicles/screens/VehicleFormScreen";

export default async function EditVehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  return <VehicleFormScreen vehicleId={vehicleId} />;
}
