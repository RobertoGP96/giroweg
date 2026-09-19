import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type AuthToken = string | (() => Promise<string>);

/**
 * Drizzle client over Neon's HTTP driver: one round trip per query, ideal
 * for serverless route handlers. Use the pooled `DATABASE_URL`.
 *
 * Pass `authToken` (a Neon Auth JWT) to run as the `authenticated` role
 * with row-level security applied; omit it for the database owner (sync
 * engine, migrations, admin jobs), which bypasses RLS.
 */
export const createDb = (url: string, authToken?: AuthToken) => {
  const client = authToken ? neon(url, { authToken }) : neon(url);
  return drizzle({ client, schema, casing: "snake_case" });
};

export type Database = ReturnType<typeof createDb>;
