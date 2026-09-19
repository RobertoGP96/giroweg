"use client";

import type { OutboxEntry } from "@/db/store";
import { useSyncQueue } from "./useSyncQueue";

export type RecordSyncState = "synced" | "pending" | "error";

/** Sync state of one record, derived from the outbox. */
export const recordSyncState = (outbox: ReadonlyArray<OutboxEntry>, recordId: string): RecordSyncState => {
  const entries = outbox.filter((entry) => entry.recordId === recordId);
  if (entries.length === 0) return "synced";
  return entries.some((entry) => entry.lastError !== null) ? "error" : "pending";
};

export const useRecordSync = (recordId: string): RecordSyncState =>
  recordSyncState(useSyncQueue(), recordId);
