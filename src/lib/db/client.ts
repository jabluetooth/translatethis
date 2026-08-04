import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Lazily connects on first use so importing this module (or anything that
 * transitively imports it) never fails just because DATABASE_URL isn't set
 * yet — only code paths that actually touch history/glossary need it.
 */
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Provision Supabase Postgres and set it in .env.local to use history/glossary features.");
  }
  if (!dbInstance) {
    // DATABASE_URL is expected to be Supabase's transaction pooler (port
    // 6543), which doesn't support prepared statements — must be disabled.
    // https://orm.drizzle.team/docs/get-started/supabase-new
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
