import type { NextRequest } from "next/server";
import { getAuth } from "@/auth/server";

/**
 * Route protection: every app route needs a Neon Auth session except the
 * public entry points (onboarding, login, the auth proxy and health check)
 * and the PWA files (manifest, service worker, icons, offline fallback),
 * which the browser fetches without cookies.
 * Unauthenticated requests are redirected to /login.
 */
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|offline|api/auth|api/health|login|onboarding).*)"],
};
