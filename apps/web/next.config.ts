import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@giroweg/shared", "@giroweg/db"],
  // Route transitions use React 19.3's <ViewTransition> directly (src/ui/PageTransition.tsx);
  // Next 16.3 no longer needs an experimental flag for it.
  async headers() {
    return [
      {
        // The service worker must never be served stale, or updates would wait a day.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
