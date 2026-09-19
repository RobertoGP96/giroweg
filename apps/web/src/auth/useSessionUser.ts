"use client";

import { authClient } from "./client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Up to two initials for avatars, e.g. "MR". */
  initials: string;
  /** First word of the name, or the mailbox before "@". */
  firstName: string;
}

const initialsOf = (name: string, email: string): string => {
  const source = name.trim() || email.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
};

/** The signed-in Neon Auth user, or null while loading / signed out. */
export const useSessionUser = (): { user: SessionUser | null; loading: boolean } => {
  const { data, isPending } = authClient.useSession();
  const raw = data?.user;
  if (!raw) return { user: null, loading: isPending };
  const name = raw.name ?? "";
  const email = raw.email ?? "";
  return {
    loading: false,
    user: {
      id: raw.id,
      name,
      email,
      initials: initialsOf(name, email),
      firstName: name.trim().split(/\s+/)[0] || email.split("@")[0] || "",
    },
  };
};
