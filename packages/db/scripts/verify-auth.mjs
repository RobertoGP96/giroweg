// End-to-end check of Neon Auth + database access: signs up a throwaway user
// through the Neon Auth REST API, fetches its JWT, verifies it the way the
// web server does (JWKS) and exercises the owner-side onboarding function.
// The JWT-bound paths (Data API / serverless driver authToken) are reported
// as informational because Neon does not accept Neon Auth's EdDSA tokens
// there yet. Prints the user id so it can be deleted afterwards with
// `neon neon-auth user delete <id>`.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";

const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const base = env.NEON_AUTH_BASE_URL;
const email = `verify-${Date.now()}@giroweg.test`;
const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const results = [];
const record = (label, ok, detail = "", optional = false) => {
  results.push({ label, ok, optional });
  const tag = ok ? "PASS" : optional ? "INFO" : "FAIL";
  console.log(tag, label, detail ? `-> ${detail}` : "");
};

let cookie = "";
const call = async (path, init = {}) => {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie, ...(init.headers ?? {}) },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

let userId = null;
let orgId = null;
const owner = neon(env.DATABASE_URL_UNPOOLED);
try {
  const signUp = await call("/sign-up/email", { method: "POST", body: JSON.stringify({ email, password, name: "Verify Bot" }) });
  userId = signUp.body?.user?.id ?? null;
  record("sign-up/email creates a user", signUp.status === 200 && Boolean(userId), `status ${signUp.status}`);

  const token = await call("/token", { method: "GET" });
  const jwt = token.body?.token;
  record("GET /token returns a JWT", Boolean(jwt), `status ${token.status}`);

  if (jwt) {
    const { payload } = await jwtVerify(jwt, createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL)), {
      issuer: new URL(base).origin,
    });
    record("server-side JWKS verification (jose) yields sub = user id", payload.sub === userId, `sub=${payload.sub}`);

    if (env.NEON_DATA_API_URL) {
      const res = await fetch(`${env.NEON_DATA_API_URL}/memberships?select=org_id&limit=1`, {
        headers: { authorization: `Bearer ${jwt}`, accept: "application/json" },
      });
      record("Data API accepts the JWT (GET /memberships)", res.status === 200, `status ${res.status} ${(await res.text()).slice(0, 60)}`, true);
    }
    try {
      const sql = neon(env.DATABASE_URL, { authToken: jwt });
      const [row] = await sql`select auth.user_id() as uid`;
      record("serverless driver authToken sets auth.user_id()", row.uid === userId, JSON.stringify(row), true);
    } catch (e) {
      record("serverless driver authToken sets auth.user_id()", false, e.message.slice(0, 80), true);
    }

    // Owner path used by the web server after verifying the JWT.
    const [created] = await owner`select create_organization_for(${payload.sub}, 'Verify org') as id`;
    orgId = created?.id ?? null;
    record("create_organization_for() creates org + owner membership", Boolean(orgId), orgId ?? "");
    const [membership] = await owner`select role from memberships where org_id = ${orgId} and user_id = ${payload.sub}`;
    record("membership row is owner", membership?.role === "owner", JSON.stringify(membership));
    try {
      const restricted = neon(env.DATABASE_URL, { authToken: jwt });
      await restricted`select create_organization_for('x', 'y')`;
      record("create_organization_for() is not callable by JWT roles", false, "call succeeded", true);
    } catch (e) {
      record("create_organization_for() is not callable by JWT roles", true, e.message.slice(0, 60), true);
    }
  }
} finally {
  if (orgId) {
    await owner.transaction([owner`set local giroweg.allow_purge = 'on'`, owner`delete from organizations where id = ${orgId}`]);
    record("cleanup: organization purged", true);
  }
  console.log(`\nTest user: ${email} (id ${userId ?? "?"}). Delete it with: pnpm exec neon neon-auth user delete ${userId ?? "<id>"}`);
}

process.exit(results.every((r) => r.ok || r.optional) ? 0 : 1);
