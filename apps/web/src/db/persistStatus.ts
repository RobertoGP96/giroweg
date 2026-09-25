"use client";

import { create } from "zustand";

interface PersistStatusState {
  /** localStorage refused the last write for lack of space; data lives only in memory. */
  quotaExceeded: boolean;
  setQuotaExceeded: (quotaExceeded: boolean) => void;
}

/** Ephemeral UI state of the localStorage mirror (persistence.ts). */
export const usePersistStatus = create<PersistStatusState>((set) => ({
  quotaExceeded: false,
  setQuotaExceeded: (quotaExceeded) => set({ quotaExceeded }),
}));

const QUOTA_ERROR_NAME = "QuotaExceededError";
/** Legacy codes: 22 (most browsers) and 1014 (Firefox NS_ERROR_DOM_QUOTA_REACHED). */
const QUOTA_ERROR_CODES: ReadonlySet<number> = new Set([22, 1014]);

/** True when a storage write failed because the browser quota is full. */
export const isQuotaError = (error: unknown): boolean => {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === QUOTA_ERROR_NAME || QUOTA_ERROR_CODES.has(error.code);
  }
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? error.name : undefined;
  const code = "code" in error ? error.code : undefined;
  return name === QUOTA_ERROR_NAME || (typeof code === "number" && QUOTA_ERROR_CODES.has(code));
};
