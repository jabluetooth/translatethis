import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as a standalone CLI, outside Next.js's own env loader, so
// .env.local has to be loaded explicitly here.
config({ path: ".env.local" });

// Migrations run DDL over a real session, which Supabase's transaction
// pooler (port 6543, used by DATABASE_URL at app runtime) doesn't support
// well — use the direct connection (port 5432) here instead.
// https://orm.drizzle.team/docs/get-started/supabase-new
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
