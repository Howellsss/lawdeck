import { beforeEach, describe, expect, it, vi } from "vitest";
import writ from "@/templates/documents/writ-of-summons.json";
import lagos from "@/templates/forums/lagos-high-court.json";

// A pretend sign-in and database: nothing real is touched. Made-up names only.
const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const DOC = "cccccccc-0000-4000-8000-000000000003";
const SHARE = "dddddddd-0000-4000-8000-000000000004";
const TOKEN = "a".repeat(64);
const account = vi.fn();
const rpc = vi.fn();
const insert = vi.fn();
const update = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    rpc,
    from: () => ({
      insert: async (row: unknown) => insert(row),
      update: (row: unknown) => ({ eq: () => ({ is: () => ({ select: async () => update(row) }) }) }),
    }),
  }),
}));
const { createShare, revokeShare } = await import("@/server/sharing/actions");
const { openShare, getSharedDocument, getSharedChat } = await import("@/server/db/sharing");

beforeEach(() => {
  for (const fn of [account, rpc, insert, update]) fn.mockReset();
  account.mockResolvedValue({ id: USER });
  insert.mockResolvedValue({ error: null });
  update.mockResolvedValue({ data: [{ id: SHARE }], error: null });
});

describe("making and turning off links", () => {
  it("needs sign-in and a real id before anything is stored", async () => {
    account.mockResolvedValue(null);
    expect((await createShare("document", DOC)).ok).toBe(false);
    account.mockResolvedValue({ id: USER });
    expect((await createShare("document", "not-an-id")).ok).toBe(false);
    expect((await createShare("folder" as never, DOC)).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("links exactly one document or one project", async () => {
    await createShare("document", DOC);
    await createShare("project", DOC);
    expect(insert.mock.calls.map((c) => c[0])).toEqual([
      { kind: "document", document_id: DOC, project_id: null },
      { kind: "project", document_id: null, project_id: DOC },
    ]);
  });

  it("says so when the work is not the student's own (or was deleted)", async () => {
    insert.mockResolvedValue({ error: { code: "23503" } });
    expect(await createShare("document", DOC)).toEqual({ ok: false, message: expect.stringContaining("could not be found") });
  });

  it("turns a link off, once", async () => {
    expect(await revokeShare(SHARE)).toEqual({ ok: true });
    expect(update.mock.calls[0][0]).toMatchObject({ revoked_at: expect.any(String) });
    update.mockResolvedValue({ data: [], error: null });
    expect(await revokeShare(SHARE)).toEqual({ ok: false, message: "That link was already turned off." });
    account.mockResolvedValue(null);
    expect((await revokeShare(SHARE)).ok).toBe(false);
  });
});

describe("opening a link", () => {
  it("asks visitors to sign in, and never asks the database about a malformed link", async () => {
    account.mockResolvedValue(null);
    expect(await openShare(TOKEN)).toEqual({ status: "signed-out" });
    account.mockResolvedValue({ id: USER });
    expect(await openShare("../../etc")).toEqual({ status: "ok", data: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns nothing for a turned-off link", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await openShare(TOKEN)).toEqual({ status: "ok", data: null });
  });
});

const sharedRow = (over: Record<string, unknown> = {}) => ({
  title: "Quokka writ",
  forum_name: "Lagos High Court",
  forum_slug: lagos.slug,
  forum_profile: lagos.profile,
  forum_status: "approved",
  template_spec: writ.spec,
  template_status: "approved",
  content: { fields: {} },
  updated_at: "2026-10-23T10:00:00Z",
  ...over,
});

describe("a shared document", () => {
  it("is drawn as pages with a reviewed template and court", async () => {
    rpc.mockResolvedValue({ data: [sharedRow()], error: null });
    const document = await getSharedDocument(TOKEN, DOC);
    expect(document?.model?.title).toBe("Quokka writ");
  });

  it("is not drawn while its template or court is being reviewed again", async () => {
    rpc.mockResolvedValue({ data: [sharedRow({ template_status: "withdrawn" })], error: null });
    expect((await getSharedDocument(TOKEN, DOC))?.model).toBeNull();
    rpc.mockResolvedValue({ data: [sharedRow({ forum_status: "pending" })], error: null });
    expect((await getSharedDocument(TOKEN, DOC))?.model).toBeNull();
  });
});

describe("a shared chat", () => {
  it("shows questions, answers and source titles, skipping anything malformed", async () => {
    rpc.mockResolvedValue({
      data: [
        { role: "user", content: { text: "What is a quokka writ?" }, created_at: "2026-10-23T10:00:00Z", sources: [] },
        {
          role: "assistant",
          content: { text: "A made-up writ [S1].", level: "exam" },
          created_at: "2026-10-23T10:00:05Z",
          sources: [{ label: 1, title: "Quokka notes", origin: "upload" }, { label: "x" }],
        },
      ],
      error: null,
    });
    const messages = await getSharedChat(TOKEN, DOC);
    expect(messages[1]).toMatchObject({ level: "exam", sources: [{ label: 1, title: "Quokka notes", origin: "upload" }] });
  });
});
