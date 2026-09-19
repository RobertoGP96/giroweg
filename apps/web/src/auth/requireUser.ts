import "server-only";

import { asc, eq, schema, sql } from "@giroweg/db";
import { NextResponse } from "next/server";
import { getServerDb } from "@/db/server";
import { readBearerToken } from "@/db/user";
import { getAuth } from "./server";
import { verifyToken } from "./verifyToken";

export interface RequestUser {
  /** Neon Auth user id (JWT subject). */
  id: string;
  email: string | null;
  name: string | null;
  /** Organization the user writes to, or null before onboarding. */
  orgId: string | null;
}

type AuthResult = { user: RequestUser; error?: undefined } | { user?: undefined; error: NextResponse };

const unauthorized = (code: string): AuthResult => ({
  error: NextResponse.json({ error: code }, { status: 401 }),
});

/**
 * Identifies the caller of an API route from the Neon Auth session cookie,
 * which the Neon Auth service validates server-side. When the request also
 * carries a bearer JWT it is verified against the project JWKS and must
 * belong to the same user (it is what the JWT-bound database role will use
 * once Neon accepts Neon Auth's EdDSA tokens; see CLAUDE.md, "Seguridad").
 * The database owner then runs every query scoped to the user's organization.
 */
export const authenticate = async (request: Request): Promise<AuthResult> => {
  const { data: session } = await getAuth().getSession();
  const sessionUser = session?.user;
  if (!sessionUser) return unauthorized("unauthenticated");

  const token = readBearerToken(request);
  if (token) {
    let verifiedId: string;
    try {
      verifiedId = (await verifyToken(token)).id;
    } catch {
      return unauthorized("invalid_token");
    }
    if (verifiedId !== sessionUser.id) return unauthorized("token_mismatch");
  }

  const db = getServerDb();
  const memberships = await db
    .select({ orgId: schema.memberships.orgId })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, sessionUser.id))
    .orderBy(
      sql`case ${schema.memberships.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
      asc(schema.memberships.createdAt),
    )
    .limit(1);

  return {
    user: {
      id: sessionUser.id,
      email: sessionUser.email ?? null,
      name: sessionUser.name?.trim() || null,
      orgId: memberships[0]?.orgId ?? null,
    },
  };
};
