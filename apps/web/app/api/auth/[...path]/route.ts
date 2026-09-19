import type { NextRequest } from "next/server";
import { getAuth } from "@/auth/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

// Resolved per request so the build never needs the Neon Auth env.
export const GET = (request: NextRequest, context: Context) => getAuth().handler().GET(request, context);
export const POST = (request: NextRequest, context: Context) => getAuth().handler().POST(request, context);
