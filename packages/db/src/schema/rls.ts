import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/neon";
import { pgPolicy, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Row-level security based on memberships. `is_org_member(org_id)` and
 * `is_org_admin(org_id)` are SQL functions (migration 0000) that compare
 * the JWT subject from Neon Auth (`auth.user_id()`) with `memberships`.
 * The `authenticated` role is the one Neon binds to end-user JWTs; the
 * database owner used by the sync engine bypasses RLS.
 */
export const isOrgMember = (orgId: AnyPgColumn) => sql`is_org_member(${orgId})`;
export const isOrgAdmin = (orgId: AnyPgColumn) => sql`is_org_admin(${orgId})`;

interface OrgPolicyOptions {
  /** Who may delete: admins/owners, any member, or nobody (append-only tables). */
  delete?: "admin" | "member" | "none";
  /** Allow updates by members (default true). */
  update?: boolean;
}

/** Standard CRUD policies for a table that hangs from `org_id`. */
export const orgPolicies = (table: string, orgId: AnyPgColumn, options: OrgPolicyOptions = {}) => {
  const { delete: del = "admin", update = true } = options;
  const policies = [
    pgPolicy(`${table}_select`, { for: "select", to: authenticatedRole, using: isOrgMember(orgId) }),
    pgPolicy(`${table}_insert`, { for: "insert", to: authenticatedRole, withCheck: isOrgMember(orgId) }),
  ];
  if (update) {
    policies.push(
      pgPolicy(`${table}_update`, {
        for: "update",
        to: authenticatedRole,
        using: isOrgMember(orgId),
        withCheck: isOrgMember(orgId),
      }),
    );
  }
  if (del !== "none") {
    policies.push(
      pgPolicy(`${table}_delete`, {
        for: "delete",
        to: authenticatedRole,
        using: del === "admin" ? isOrgAdmin(orgId) : isOrgMember(orgId),
      }),
    );
  }
  return policies;
};
