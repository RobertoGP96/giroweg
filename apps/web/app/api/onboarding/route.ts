import { eq, schema, sql } from "@giroweg/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth/server";
import { verifyToken } from "@/auth/verifyToken";
import { getServerDb } from "@/db/server";
import { readBearerToken } from "@/db/user";

export const dynamic = "force-dynamic";

/**
 * Ensures the signed-in user belongs to an organization and creates a
 * personal one (owner membership) on first sign-in.
 *
 * Identity comes from the Neon Auth JWT verified against the project JWKS;
 * the database owner then runs the queries scoped to that user id (see
 * CLAUDE.md, "Seguridad": Neon's JWT-bound role is not usable with Neon
 * Auth's EdDSA tokens yet, so user scoping happens here on the server).
 */
export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  const sessionUser = session?.user;
  if (!sessionUser) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  try {
    const user = await verifyToken(token);
    if (user.id !== sessionUser.id) return NextResponse.json({ error: "token_mismatch" }, { status: 401 });

    const db = getServerDb();
    const existing = await db
      .select({ orgId: schema.memberships.orgId })
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, user.id))
      .limit(1);
    let organizationId = existing[0]?.orgId ?? null;

    if (!organizationId) {
      const name = sessionUser.name?.trim() || sessionUser.email?.split("@")[0] || "GiroWeg";
      const created = await db.execute<{ id: string }>(
        sql`select create_organization_for(${user.id}, ${name}) as id`,
      );
      organizationId = created.rows[0]?.id ?? null;
    }

    return NextResponse.json({ organizationId, needsName: !sessionUser.name?.trim() });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const unauthorized = /jwt|jws|token|signature|expired/i.test(message);
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
