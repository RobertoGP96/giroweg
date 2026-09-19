"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser auth client. Talks to /api/auth (proxied to Neon Auth) and keeps the
 * session cookie; `authClient.useSession()` gives the signed-in user and
 * `authClient.token()` a short-lived JWT for user-scoped API calls.
 */
export const authClient = createAuthClient();
