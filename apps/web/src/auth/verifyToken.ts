import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

export interface VerifiedUser {
  /** Neon Auth user id (`sub`). */
  id: string;
  email: string | null;
  role: string | null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJwks = () => {
  if (jwks) return jwks;
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) throw new Error("NEON_AUTH_JWKS_URL is not set. Run `pnpm db:env`.");
  jwks = createRemoteJWKSet(new URL(url));
  return jwks;
};

const expectedIssuer = (): string | undefined => {
  const base = process.env.NEON_AUTH_BASE_URL;
  return base ? new URL(base).origin : undefined;
};

/**
 * Verifies a Neon Auth JWT (EdDSA, signed by the project's Neon Auth
 * instance) against its JWKS and returns the identity it carries. Server
 * routes use it to act on behalf of a user with the database owner while
 * scoping every query to the verified user id.
 */
export const verifyToken = async (token: string): Promise<VerifiedUser> => {
  const issuer = expectedIssuer();
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ["EdDSA", "ES256", "RS256"],
    ...(issuer ? { issuer } : {}),
  });
  if (!payload.sub) throw new Error("Token has no subject");
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : null,
  };
};
