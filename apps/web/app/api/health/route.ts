import { sql } from "@giroweg/db";
import { NextResponse } from "next/server";
import { getServerDb } from "@/db/server";

export const dynamic = "force-dynamic";

/** Liveness check against Neon: confirms env + connection + applied migrations. */
export async function GET() {
  try {
    const db = getServerDb();
    const status = await db.execute<{ now: string; version: string }>(
      sql`select now()::text as now, version() as version`,
    );
    // drizzle-kit keeps its journal in drizzle.__drizzle_migrations (hash, created_at ms).
    const migrations = await db.execute<{ applied: number; last: string | null }>(
      sql`select count(*)::int as applied, max(created_at)::text as last from drizzle.__drizzle_migrations`,
    );
    const row = status.rows[0];
    const journal = migrations.rows[0];
    return NextResponse.json({
      ok: true,
      serverTime: row?.now ?? null,
      postgres: row?.version?.split(" on ")[0] ?? null,
      migrationsApplied: journal?.applied ?? 0,
      lastMigrationAt: journal?.last ? new Date(Number(journal.last)).toISOString() : null,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
