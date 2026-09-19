import { z } from "zod";

/** UUID v7 generated on the client (domain rule 5). */
export const idSchema = z.uuid();

/** ISO 8601 timestamp stored in UTC (domain rule 5). */
export const timestampSchema = z.iso.datetime({ offset: true });

export const syncStatusSchema = z.enum(["pending", "syncing", "synced", "error"]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const auditFields = {
  id: idSchema,
  orgId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  syncedAt: timestampSchema.nullable(),
};
