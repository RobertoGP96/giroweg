import { sql } from "drizzle-orm";
import { uuid } from "drizzle-orm/pg-core";
import { timestamptz } from "./helpers";
import { organizations } from "./organizations";

export { distance, timestamptz } from "./helpers";

/**
 * Columns every synced record shares. `id` is a UUID v7 generated on the
 * client (domain rule 5); `created_at`/`updated_at` are device time and
 * `synced_at` is server time, stamped by a trigger on every write.
 */
export const syncedRecord = {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamptz("created_at").notNull(),
  updatedAt: timestamptz("updated_at").notNull(),
  syncedAt: timestamptz("synced_at")
    .notNull()
    .default(sql`now()`),
};
