import "server-only";
import { z } from "@/lib/zod";
import { TERMS_VERSION } from "@/lib/terms";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Acceptance of the Terms of Use and Privacy Notice (founder, 2026-11-13; questionnaire Q86).
// Switched on only when both published addresses are set, so it never asks students to accept
// documents they cannot open.

export type TermsLinks = { terms: string; privacy: string };

const httpsUrl = z.url({ protocol: /^https$/ });

export function termsLinks(): TermsLinks | null {
  const terms = httpsUrl.safeParse(process.env.TERMS_URL?.trim());
  const privacy = httpsUrl.safeParse(process.env.PRIVACY_URL?.trim());
  return terms.success && privacy.success ? { terms: terms.data, privacy: privacy.data } : null;
}

// Records the signed-in person's acceptance of the current version (the database sets who and when).
// A second record of the same version is not an error.
export async function recordAcceptance(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("terms_acceptances").insert({ terms_version: TERMS_VERSION });
  if (error && error.code !== "23505") {
    console.error("terms acceptance failed", { code: error.code ?? "unknown" });
    return false;
  }
  return true;
}

// Whether the signed-in person still has to accept the current version. Someone who ticked the box
// at sign-up (kept with the account as the version they accepted) is recorded here without asking again.
export async function termsToAccept(): Promise<TermsLinks | null> {
  const links = termsLinks();
  if (!links) return null;
  const account = await getCurrentAccount();
  if (!account) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("id")
    .eq("owner_id", account.id)
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();
  if (error) {
    console.error("terms check failed", { code: error.code ?? "unknown" });
    return null;
  }
  if (data) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const meta = claims?.claims?.user_metadata as { terms_version?: unknown } | undefined;
  if (meta?.terms_version === TERMS_VERSION && (await recordAcceptance())) return null;
  return links;
}
