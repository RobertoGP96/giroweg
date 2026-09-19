import { defineConfig } from "@neon/config/v1";

/**
 * Neon services every branch of GiroWeg gets:
 * - Lakebase Postgres (always) → DATABASE_URL, DATABASE_URL_UNPOOLED
 * - Neon Auth (managed Better Auth) → NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL
 * - Data API: validates end-user JWTs and provides `auth.user_id()`, which
 *   the row-level security policies use → NEON_DATA_API_URL
 * - `vehicles` bucket (private, signed access) for odometer and receipt photos
 *
 * Reconcile with `pnpm db:deploy` (neon deploy). Dev branches scale to zero.
 */
export default defineConfig({
  auth: true,
  dataApi: true,
  preview: {
    // Upgrade to a paid plan to enable AI Gateway for your project.
    // aiGateway: true,
    buckets: {
      vehicles: { access: "private" },
    },
  },
  branch: (branch) => {
    if (branch.exists) return {};
    if (branch.name.startsWith("dev")) {
      return {
        ttl: "14d",
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: "5m",
          },
        },
      };
    }
    return {};
  },
});
