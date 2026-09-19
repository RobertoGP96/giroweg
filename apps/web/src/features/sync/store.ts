"use client";

import { create } from "zustand";

interface SyncStatusState {
  syncing: boolean;
  /** Last time push + pull completed without a transport error. */
  lastSyncAt: string | null;
  lastError: string | null;
}

/** Ephemeral UI state of the sync engine (the outbox itself lives in the local store). */
export const useSyncStatus = create<SyncStatusState>(() => ({
  syncing: false,
  lastSyncAt: null,
  lastError: null,
}));
