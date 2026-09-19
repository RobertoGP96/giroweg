"use client";

import { authClient } from "@/auth/client";

/** Reuse the short-lived JWT until shortly before it expires. */
const TOKEN_MARGIN_MS = 30_000;
let cached: { token: string; expiresAt: number } | null = null;

const expiryOf = (token: string): number => {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: unknown };
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) return cached.token;
  const { data } = await authClient.token();
  const token = data?.token ?? null;
  cached = token ? { token, expiresAt: expiryOf(token) || Date.now() + 60_000 } : null;
  return token;
};

export const clearAccessToken = (): void => {
  cached = null;
};

/** fetch with the Neon Auth bearer token; JSON body when one is given. */
export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) clearAccessToken();
  return response;
};
