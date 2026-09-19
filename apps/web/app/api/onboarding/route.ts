import { sql } from "@giroweg/db";
import { NextResponse } from "next/server";
import { authenticate } from "@/auth/requireUser";
import { getServerDb } from "@/db/server";

export const dynamic = "force-dynamic";

/**
 * Ensures the signed-in user belongs to an organization and creates a
 * personal one (owner membership) on first sign-in. Returns the ids the
 * device needs to write records locally before its first sync.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    let organizationId = user.orgId;
    if (!organizationId) {
      const name = user.name || user.email?.split("@")[0] || "GiroWeg";
      const created = await getServerDb().execute<{ id: string }>(
        sql`select create_organization_for(${user.id}, ${name}) as id`,
      );
      organizationId = created.rows[0]?.id ?? null;
    }
    return NextResponse.json({ userId: user.id, organizationId, needsName: user.name === null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
