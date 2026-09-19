import "server-only";

import { createDb, type Database } from "@giroweg/db";

/**
 * Server-side Drizzle client (route handlers, server actions). Uses the
 * database owner over the pooled URL: RLS is bypassed, so only the sync
 * engine and admin code may import this. Per-user access goes through
 * `createDb(url, authToken)` with the Neon Auth JWT.
 */
let db: Database | null = null;

export const getServerDb = (): Database => {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm db:env` to pull the Neon branch env.");
  db = createDb(url);
  return db;
};
