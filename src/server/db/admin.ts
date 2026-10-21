import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/server/auth/config";
import type { Database } from "./types";

// ADMIN JOBS ONLY (CLAUDE.md, Security: "Service-role key only in marked admin jobs").
// This client ignores row-level security. Use it only in files marked "ADMIN JOB", and only
// after the caller's role has been checked on the server. Never in screens or student requests.
export function createAdminClient() {
  const config = getSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceKey) return null;
  return createClient<Database>(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
