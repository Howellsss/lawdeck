import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Private uploads on the real Supabase project (migration 24; PRD UP-02): a second student can
// never list, download, delete or see another student's file. Same test students and settings as
// workspace.test.ts; missing settings fail the run on purpose.

function setting(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing setting ${name}. See tests/permissions/README.md.`,
    );
  return value;
}

const url = setting("NEXT_PUBLIC_SUPABASE_URL");
const key = setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

async function signedIn(emailVar: string, passwordVar: string) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: setting(emailVar),
    password: setting(passwordVar),
  });
  if (error || !data.user)
    throw new Error(`Could not sign in the test account in ${emailVar}.`);
  return { client, id: data.user.id };
}

let a: { client: SupabaseClient; id: string };
let b: { client: SupabaseClient; id: string };
let path: string;
let uploadId: string;
const pdf = new Blob([new TextEncoder().encode("%PDF-1.4 permission test")], {
  type: "application/pdf",
});

beforeAll(async () => {
  a = await signedIn("TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD");
  b = await signedIn("TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD");
  const notice = await a.client.rpc("accept_upload_notice");
  if (notice.error)
    throw new Error(
      `A could not accept the upload notice: ${notice.error.message}`,
    );
  path = `${a.id}/${crypto.randomUUID()}.pdf`;
  const stored = await a.client.storage
    .from("uploads")
    .upload(path, pdf, { contentType: "application/pdf" });
  if (stored.error)
    throw new Error(`A could not store a file: ${stored.error.message}`);
  const row = await a.client
    .from("uploads")
    .insert({
      file_name: "permission-test.pdf",
      mime_type: "application/pdf",
      size_bytes: pdf.size,
      storage_path: path,
    })
    .select("id")
    .single();
  if (row.error)
    throw new Error(`A could not record the upload: ${row.error.message}`);
  uploadId = row.data.id;
});

afterAll(async () => {
  await a?.client.storage.from("uploads").remove([path]);
  await a?.client.from("uploads").delete().eq("id", uploadId);
  await a?.client.auth.signOut();
  await b?.client.auth.signOut();
});

describe("private uploads", () => {
  it("A can see and download their own file", async () => {
    expect(
      (await a.client.from("uploads").select("id").eq("id", uploadId)).data,
    ).toHaveLength(1);
    expect(
      (await a.client.storage.from("uploads").download(path)).error,
    ).toBeNull();
  });

  it("B cannot see A's upload record or list A's folder", async () => {
    expect(
      (await b.client.from("uploads").select("id").eq("id", uploadId)).data,
    ).toEqual([]);
    const listed = await b.client.storage.from("uploads").list(a.id);
    expect(listed.data ?? []).toEqual([]);
  });

  it("B cannot download, delete or overwrite A's file", async () => {
    expect(
      (await b.client.storage.from("uploads").download(path)).error,
    ).not.toBeNull();
    await b.client.storage.from("uploads").remove([path]);
    await b.client.from("uploads").delete().eq("id", uploadId);
    expect(
      (await a.client.storage.from("uploads").download(path)).error,
    ).toBeNull();
    expect(
      (await a.client.from("uploads").select("id").eq("id", uploadId)).data,
    ).toHaveLength(1);
    const overwrite = await b.client.storage
      .from("uploads")
      .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
    expect(overwrite.error).not.toBeNull();
  });

  it("B cannot put a file in A's folder or add passages to A's upload", async () => {
    const planted = await b.client.storage
      .from("uploads")
      .upload(`${a.id}/${crypto.randomUUID()}.pdf`, pdf, {
        contentType: "application/pdf",
      });
    expect(planted.error).not.toBeNull();
    const passage = await b.client
      .from("upload_passages")
      .insert({ upload_id: uploadId, position: 0, text: "planted" });
    expect(passage.error).not.toBeNull();
  });

  it("B cannot see A's page text or run the reading functions on A's file", async () => {
    expect(
      (
        await b.client
          .from("upload_pages")
          .select("page")
          .eq("upload_id", uploadId)
      ).data ?? [],
    ).toEqual([]);
    for (const [fn, args] of [
      ["restart_upload_reading", { target: uploadId }],
      [
        "replace_upload_passages",
        {
          target: uploadId,
          passages: [{ text: "planted" }],
          quality: 1,
          pages: 1,
        },
      ],
      ["finish_upload_reading", { target: uploadId }],
      ["fail_upload_reading", { target: uploadId, reason: "sabotage" }],
    ] as const) {
      expect((await b.client.rpc(fn, args as never)).error).not.toBeNull();
    }
    const row = await a.client
      .from("uploads")
      .select("status, problem")
      .eq("id", uploadId)
      .single();
    expect(row.data).toEqual({ status: "processing", problem: null });
  });
});
