import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/neon";
import { index, pgPolicy, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { membershipRole } from "./enums";
import { timestamptz } from "./helpers";

/**
 * Every record hangs from an organization. A single user is an organization
 * of one person, created through `create_organization()` (migration 0002)
 * so the owner membership is written in the same transaction.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text("name").notNull(),
    createdAt: timestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    pgPolicy("organizations_select", { for: "select", to: authenticatedRole, using: sql`is_org_member(${t.id})` }),
    pgPolicy("organizations_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`is_org_admin(${t.id})`,
      withCheck: sql`is_org_admin(${t.id})`,
    }),
  ],
).enableRLS();

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Neon Auth user id (text, from the JWT subject). */
    userId: text("user_id").notNull(),
    role: membershipRole("role").notNull().default("member"),
    createdAt: timestamptz("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("memberships_org_user_idx").on(t.orgId, t.userId),
    index("memberships_user_idx").on(t.userId),
    pgPolicy("memberships_select", { for: "select", to: authenticatedRole, using: sql`is_org_member(${t.orgId})` }),
    pgPolicy("memberships_insert", { for: "insert", to: authenticatedRole, withCheck: sql`is_org_admin(${t.orgId})` }),
    pgPolicy("memberships_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`is_org_admin(${t.orgId})`,
      withCheck: sql`is_org_admin(${t.orgId})`,
    }),
    pgPolicy("memberships_delete", { for: "delete", to: authenticatedRole, using: sql`is_org_admin(${t.orgId})` }),
  ],
).enableRLS();
