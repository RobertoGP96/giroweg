"use client";

import { getStore } from "@/db/client";
import { apiFetch } from "@/features/sync/api";
import { syncNow } from "@/features/sync/engine";

interface OnboardingResult {
  userId: string;
  organizationId: string | null;
  needsName: boolean;
}

/**
 * After a successful sign-in: make sure the user has an organization (a
 * person is an organization of one), remember it on this device so writes
 * work before the first sync, pull the account's data and decide where to
 * go next.
 */
export const completeSignIn = async (): Promise<string> => {
  const response = await apiFetch("/api/onboarding", { method: "POST" });
  if (!response.ok) return "/welcome";
  const result = (await response.json()) as OnboardingResult;

  const store = getStore();
  if (result.organizationId) {
    if (store.session && store.session.userId !== result.userId) store.reset();
    store.setSession({ userId: result.userId, orgId: result.organizationId });
    await syncNow();
  }
  return result.needsName ? "/welcome" : "/home";
};
