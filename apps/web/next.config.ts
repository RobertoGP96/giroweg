import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@giroweg/shared", "@giroweg/db"],
  // Route transitions use React 19.3's <ViewTransition> directly (src/ui/PageTransition.tsx);
  // Next 16.3 no longer needs an experimental flag for it.
};

export default nextConfig;
