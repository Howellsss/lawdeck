import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Migration 29 on the real Supabase project (rules C-04, K-02). Read-only: nothing is recorded,
// so no real sign-in is ever paused by this test. Missing settings fail the run on purpose.

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name}. See tests/permissions/README.md.`);
  return value;
}

const visitor = createClient(setting("NEXT_PUBLIC_SUPABASE_URL"), setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Made-up scrambled values that no real email or address produces.
const hashes = { email_hash: "0".repeat(63) + "1", ip_hash: "0".repeat(63) + "2" };

describe("sign-in limits", () => {
  it("the check works for visitors and says go ahead for a fresh email", async () => {
    const { data, error } = await visitor.rpc("auth_wait_seconds", { kind: "sign_in", ...hashes });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it("refuses anything that is not a scrambled value", async () => {
    expect((await visitor.rpc("auth_wait_seconds", { kind: "sign_in", email_hash: "ada@example.test", ip_hash: hashes.ip_hash })).error).not.toBeNull();
  });

  it("nobody can read the recorded attempts", async () => {
    expect((await visitor.from("auth_attempts").select("id")).error).not.toBeNull();
  });
});
