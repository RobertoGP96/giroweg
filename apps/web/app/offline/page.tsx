import type { Metadata } from "next";
import { OfflineScreen } from "@/features/sync/screens/OfflineScreen";

export const metadata: Metadata = { title: "Sin conexión · GiroWeg" };

/** Served by the service worker when a page was never cached and the network is down. */
export default function OfflinePage() {
  return <OfflineScreen />;
}
