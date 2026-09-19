"use client";

import { authClient } from "@/auth/client";

interface OnboardingResult {
  organizationId: string | null;
  needsName: boolean;
}

/**
 * After a successful sign-in: make sure the user has an organization (a
 * person is an organization of one) and decide where to go next. Runs with
 * the user's JWT so row-level security applies.
 */
export const completeSignIn = async (): Promise<string> => {
  const { data } = await authClient.token();
  const token = data?.token;
  if (!token) return "/welcome";

  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return "/welcome";
  const result = (await response.json()) as OnboardingResult;
  return result.needsName ? "/welcome" : "/vehicles";
};
