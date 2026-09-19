import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Locally run \`pnpm db:env\` and add NEON_AUTH_COOKIE_SECRET to apps/web/.env.local; on the host, define it in the project environment variables.`,
    );
  }
  return value;
};

let instance: NeonAuth | null = null;

/**
 * Neon Auth (managed Better Auth) server instance: session cookies, the
 * /api/auth proxy handler and the route-protection middleware.
 *
 * Created lazily on first use so `next build` (which evaluates route modules
 * while collecting page data) does not require the env; a missing variable
 * fails the first request with a clear message instead of the build.
 */
export const getAuth = (): NeonAuth => {
  if (instance) return instance;
  instance = createNeonAuth({
    baseUrl: requireEnv("NEON_AUTH_BASE_URL"),
    cookies: {
      secret: requireEnv("NEON_AUTH_COOKIE_SECRET"),
      sameSite: "lax",
    },
  });
  return instance;
};
