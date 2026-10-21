import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/server/db/types";
import { getSupabaseConfig } from "./config";

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured on this deployment.");
    this.name = "AuthNotConfiguredError";
  }
}

// A Supabase client for server code (pages, server actions, route handlers).
// It reads and writes the sign-in cookies of the current request.
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new AuthNotConfiguredError();
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Pages cannot set cookies. That is fine: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
