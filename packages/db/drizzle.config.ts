import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Neon writes the branch env into the web app; migrations reuse it.
config({ path: "../../apps/web/.env.local", quiet: true });

// generate/check work offline; migrate/studio need the direct (non-pooled) URL from `pnpm db:env`.
const url = process.env.DATABASE_URL_UNPOOLED ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
