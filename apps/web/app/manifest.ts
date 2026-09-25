import type { MetadataRoute } from "next";
import { colors } from "@giroweg/shared/tokens";

/** Served at /manifest.webmanifest; Next links it from every page. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GiroWeg",
    short_name: "GiroWeg",
    description: "Registro de kilometraje fiable para tu flota.",
    lang: "es",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: colors.dark.bg,
    theme_color: colors.dark.bg,
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
