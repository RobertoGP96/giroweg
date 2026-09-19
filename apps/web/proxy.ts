import { auth } from "@/auth/server";

/**
 * Route protection: every app route needs a Neon Auth session except the
 * public entry points (onboarding, login, the auth proxy and health check).
 * Unauthenticated requests are redirected to /login.
 */
export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/auth|api/health|login|onboarding).*)"],
};
