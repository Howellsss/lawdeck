import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// View-only share links on the real Supabase project (migration 27; PRD EX-04): another student
// can read through a live link only, can never change the work or see the owner's links, and a
// turned-off link stops working at once. Same test students and settings as workspace.test.ts;
// missing settings fail the run on purpose.

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name}. See tests/permissions/README.md.`);
  return value;
}

const url = setting("NEXT_PUBLIC_SUPABASE_URL");
const key = setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

async function signedIn(emailVar: string, passwordVar: string) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: setting(emailVar), password: setting(passwordVar) });
  if (error || !data.user) throw new Error(`Could not sign in the test account in ${emailVar}.`);
  return { client, id: data.user.id };
}

let a: { client: SupabaseClient; id: string };
let b: { client: SupabaseClient; id: string };
let projectId: string;
let shareId: string;
let token: string;
const name = `Share permission test ${crypto.randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  a = await signedIn("TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD");
  b = await signedIn("TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD");
  const project = await a.client.from("projects").insert({ name }).select("id").single();
  if (project.error) throw new Error(`A could not make a project: ${project.error.message}`);
  projectId = project.data.id;
  const share = await a.client.from("shares").insert({ kind: "project", project_id: projectId }).select("id, token").single();
  if (share.error) throw new Error(`A could not make a share link: ${share.error.message}`);
  shareId = share.data.id;
  token = share.data.token;
});

afterAll(async () => {
  // Deleting the project also deletes its link.
  await a?.client.from("projects").delete().eq("id", projectId);
  await a?.client.auth.signOut();
  await b?.client.auth.signOut();
});

describe("view-only share links", () => {
  it("B cannot share A's project or see A's links", async () => {
    const made = await b.client.from("shares").insert({ kind: "project", project_id: projectId });
    expect(made.error).not.toBeNull();
    expect((await b.client.from("shares").select("id").eq("id", shareId)).data).toEqual([]);
  });

  it("B opens the live link read-only, and gets no direct access", async () => {
    const opened = await b.client.rpc("open_share", { share_token: token });
    expect(opened.error).toBeNull();
    expect(opened.data).toMatchObject([{ kind: "project", title: name, is_owner: false }]);
    expect((await b.client.from("projects").select("id").eq("id", projectId)).data).toEqual([]);
    await b.client.from("projects").update({ name: "Changed by B" }).eq("id", projectId);
    expect((await a.client.from("projects").select("name").eq("id", projectId).single()).data?.name).toBe(name);
  });

  it("A sees that B opened it; B cannot see who opened it", async () => {
    expect((await a.client.rpc("share_viewers", { share: shareId })).data).toHaveLength(1);
    expect((await b.client.rpc("share_viewers", { share: shareId })).data).toEqual([]);
  });

  it("B cannot turn A's link off; A can, and it stops working at once", async () => {
    await b.client.from("shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId);
    expect((await b.client.rpc("open_share", { share_token: token })).data).toHaveLength(1);
    const off = await a.client.from("shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId);
    expect(off.error).toBeNull();
    expect((await b.client.rpc("open_share", { share_token: token })).data).toEqual([]);
  });

  it("visitors who are not signed in cannot open a link", async () => {
    const visitor = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await visitor.rpc("open_share", { share_token: token })).error).not.toBeNull();
  });
});
