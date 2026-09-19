import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run \`pnpm db:env\` and add NEON_AUTH_COOKIE_SECRET to apps/web/.env.local.`);
  return value;
};

/**
 * Neon Auth (managed Better Auth) server instance: session cookies, the
 * /api/auth proxy handler and the route-protection middleware.
 */
export const auth = createNeonAuth({
  baseUrl: requireEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: requireEnv("NEON_AUTH_COOKIE_SECRET"),
    sameSite: "lax",
  },
});
