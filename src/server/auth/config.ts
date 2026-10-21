import "server-only";
import { z } from "zod";

// Supabase settings. The URL and publishable key are not secret (they are protected by
// row-level security), but they still come from environment variables, never from code.
const configSchema = z.object({
  url: z.url(),
  key: z.string().min(20),
});

export type SupabaseConfig = z.infer<typeof configSchema>;

// Returns null when Supabase has not been set up on this deployment yet,
// so screens can say "sign-in isn't switched on yet" instead of crashing.
export function getSupabaseConfig(): SupabaseConfig | null {
  const parsed = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

// Google sign-in is switched on per deployment once it is set up in Google and Supabase.
// Screens only show the button when this is "true".
export function isGoogleSignInEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN_ENABLED === "true" && getSupabaseConfig() !== null;
}
