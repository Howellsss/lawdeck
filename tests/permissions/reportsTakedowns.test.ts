import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 28 on the real Supabase project (PRD AC-05, FB-01, FB-03). Read-only checks: nothing
// is deleted or submitted (account deletion is never run against the test accounts). Same test
// students and settings as workspace.test.ts; missing settings fail the run on purpose.

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name}. See tests/permissions/README.md.`);
  return value;
}

const url = setting("NEXT_PUBLIC_SUPABASE_URL");
const key = setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const options = { auth: { persistSession: false, autoRefreshToken: false } };

let a: SupabaseClient;
const visitor = createClient(url, key, options);

beforeAll(async () => {
  a = createClient(url, key, options);
  const { error } = await a.auth.signInWithPassword({ email: setting("TEST_USER_A_EMAIL"), password: setting("TEST_USER_A_PASSWORD") });
  if (error) throw new Error("Could not sign in the test account in TEST_USER_A_EMAIL.");
});

afterAll(async () => {
  await a?.auth.signOut();
});

describe("takedown requests and reports", () => {
  it("visitors and students cannot read takedown requests", async () => {
    expect((await visitor.from("takedown_requests").select("id")).error).not.toBeNull();
    expect((await a.from("takedown_requests").select("id")).data).toEqual([]);
  });

  it("a student cannot report work that is not their own", async () => {
    const made = await a
      .from("problem_reports")
      .insert({ target_kind: "answer", target_id: crypto.randomUUID(), category: "other" });
    expect(made.error).not.toBeNull();
  });

  it("a student cannot read what other students reported", async () => {
    expect((await a.rpc("problem_report_context", { report: crypto.randomUUID() })).data).toEqual([]);
  });
});

describe("deleting an account", () => {
  it("visitors cannot, and a student must type DELETE", async () => {
    expect((await visitor.rpc("delete_my_account", { confirm: "DELETE" })).error).not.toBeNull();
    expect((await a.rpc("delete_my_account", { confirm: "no" })).error?.message).toContain("Type DELETE");
  });
});
