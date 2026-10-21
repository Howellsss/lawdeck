import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Permission tests against the real Supabase project (rules E-06, O-02), signed in as two
// test students through the same public door the app uses. They need these settings:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD.
// Missing settings fail the run on purpose: a skipped permission test is not a pass.

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name}. See tests/permissions/README.md.`);
  return value;
}

const url = setting("NEXT_PUBLIC_SUPABASE_URL");
const key = setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signedIn(emailVar: string, passwordVar: string) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: setting(emailVar),
    password: setting(passwordVar),
  });
  if (error || !data.user) throw new Error(`Could not sign in the test account in ${emailVar}.`);
  return { client, id: data.user.id };
}

let a: { client: SupabaseClient; id: string };
let b: { client: SupabaseClient; id: string };
let projectId: string;
let conversationId: string;
const marker = `perm-test-${Date.now()}`;

beforeAll(async () => {
  a = await signedIn("TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD");
  b = await signedIn("TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD");

  const project = await a.client.from("projects").insert({ name: marker }).select("id").single();
  if (project.error) throw new Error(`A could not create a project: ${project.error.message}`);
  projectId = project.data.id;

  const chat = await a.client
    .from("conversations")
    .insert({ title: marker, project_id: projectId })
    .select("id")
    .single();
  if (chat.error) throw new Error(`A could not create a chat: ${chat.error.message}`);
  conversationId = chat.data.id;

  const message = await a.client
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content: { text: "test" } });
  if (message.error) throw new Error(`A could not add a message: ${message.error.message}`);
});

afterAll(async () => {
  // Removes the test project and chat (its messages go with it).
  await a?.client.from("conversations").delete().eq("title", marker);
  await a?.client.from("projects").delete().eq("name", marker);
  await a?.client.auth.signOut();
  await b?.client.auth.signOut();
});

describe("student A's own work", () => {
  it("A can read their own project, chat and message", async () => {
    expect((await a.client.from("projects").select("id").eq("id", projectId)).data).toHaveLength(1);
    expect((await a.client.from("messages").select("id").eq("conversation_id", conversationId)).data).toHaveLength(1);
  });

  it("A sees exactly one profile: their own, as a student", async () => {
    const { data } = await a.client.from("profiles").select("id, role");
    expect(data).toEqual([{ id: a.id, role: "student" }]);
  });
});

describe("student B cannot reach A's work", () => {
  it("cannot see A's project, chat, messages or profile", async () => {
    expect((await b.client.from("projects").select("id").eq("id", projectId)).data).toEqual([]);
    expect((await b.client.from("conversations").select("id").eq("id", conversationId)).data).toEqual([]);
    expect((await b.client.from("messages").select("id").eq("conversation_id", conversationId)).data).toEqual([]);
    expect((await b.client.from("profiles").select("id").eq("id", a.id)).data).toEqual([]);
  });

  it("cannot rename or delete A's project or chat", async () => {
    await b.client.from("projects").update({ name: "hacked" }).eq("id", projectId);
    await b.client.from("projects").delete().eq("id", projectId);
    await b.client.from("conversations").update({ title: "hacked" }).eq("id", conversationId);
    await b.client.from("conversations").delete().eq("id", conversationId);
    const project = await a.client.from("projects").select("name").eq("id", projectId).single();
    const chat = await a.client.from("conversations").select("title").eq("id", conversationId).single();
    expect(project.data?.name).toBe(marker);
    expect(chat.data?.title).toBe(marker);
  });

  it("cannot add a chat to A's project or a message to A's chat", async () => {
    const chat = await b.client.from("conversations").insert({ title: "B", project_id: projectId });
    const message = await b.client
      .from("messages")
      .insert({ conversation_id: conversationId, role: "user", content: { text: "B" } });
    expect(chat.error).not.toBeNull();
    expect(message.error).not.toBeNull();
  });

  it("cannot create a project in A's name", async () => {
    const { error } = await b.client.from("projects").insert({ name: "fake", owner_id: a.id });
    expect(error).not.toBeNull();
  });
});

describe("roles, reference data and records", () => {
  it("a student cannot make themselves an admin", async () => {
    const { error } = await b.client.from("profiles").update({ role: "admin" }).eq("id", b.id);
    expect(error).not.toBeNull();
    const { data } = await b.client.from("profiles").select("role").eq("id", b.id).single();
    expect(data?.role).toBe("student");
  });

  it("students can read the courses but not change them", async () => {
    expect((await b.client.from("courses").select("slug")).data).toHaveLength(5);
    expect((await b.client.from("courses").insert({ slug: "fake", name: "Fake" })).error).not.toBeNull();
  });

  it("students cannot write usage records or read the audit log", async () => {
    expect((await b.client.from("usage_events").insert({ owner_id: b.id, kind: "fake" })).error).not.toBeNull();
    const audit = await b.client.from("audit_log").select("id");
    expect(audit.error !== null || audit.data?.length === 0).toBe(true);
  });
});

describe("visitors who are not signed in", () => {
  it("see no private data", async () => {
    const visitor = newClient();
    for (const table of ["profiles", "projects", "conversations", "messages"]) {
      const { data, error } = await visitor.from(table).select("id").limit(1);
      expect(error !== null || data?.length === 0, table).toBe(true);
    }
  });
});

describe("the library", () => {
  it("students cannot read library passages, even approved ones", async () => {
    const { data, error } = await b.client.from("kb_passages").select("id").limit(1);
    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("students only ever see approved library items", async () => {
    const { data, error } = await b.client.from("kb_items").select("review_status");
    expect(error).toBeNull();
    expect((data ?? []).every((item) => item.review_status === "approved")).toBe(true);
  });

  it("students cannot add library items or files", async () => {
    const course = await b.client.from("courses").select("id").limit(1).single();
    const item = await b.client.from("kb_items").insert({ title: "fake", type: "note", course_id: course.data?.id });
    expect(item.error).not.toBeNull();
    const file = await b.client.storage.from("library").upload(`fake-${marker}.pdf`, new Blob(["x"]), {
      contentType: "application/pdf",
    });
    expect(file.error).not.toBeNull();
  });

  it("students are neither reviewers nor admins", async () => {
    expect((await b.client.rpc("is_reviewer")).data).toBe(false);
    expect((await b.client.rpc("is_admin")).data).toBe(false);
  });
});
