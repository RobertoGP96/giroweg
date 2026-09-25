import { and, eq, schema } from "@giroweg/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/auth/requireUser";
import { tripRouteFromRow } from "@/db/rows";
import { getServerDb } from "@/db/server";
import type { TripRouteResponse } from "@/features/sync/protocol";

export const dynamic = "force-dynamic";

const tripIdSchema = z.uuid();

/**
 * One trip's GPS route, fetched on demand: routes are heavy and never part
 * of the bulk pull. Runs as the database owner (RLS bypassed), so the
 * organization filter is what keeps other tenants' routes out.
 */
export async function GET(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  if (!user.orgId) return NextResponse.json({ error: "no_organization" }, { status: 409 });

  const tripId = tripIdSchema.safeParse((await params).tripId);
  if (!tripId.success) return NextResponse.json({ error: "invalid_trip_id" }, { status: 400 });

  try {
    const db = getServerDb();
    const [row] = await db
      .select()
      .from(schema.tripRoutes)
      .where(and(eq(schema.tripRoutes.tripId, tripId.data), eq(schema.tripRoutes.orgId, user.orgId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "route_not_found" }, { status: 404 });
    const body: TripRouteResponse = { route: tripRouteFromRow(row) };
    return NextResponse.json(body);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
