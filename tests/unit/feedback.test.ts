import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend sign-in and database: nothing real is touched. Made-up names only.
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const account = vi.fn();
const insert = vi.fn();
const rpc = vi.fn();
const update = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    rpc,
    from: () => ({
      insert: async (row: unknown) => insert(row),
      update: (row: unknown) => ({ eq: () => ({ select: async () => update(row) }) }),
    }),
  }),
}));
const { reportProblem, submitTakedown, setReportStatus } = await import("@/server/feedback/actions");

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const takedown = { name: "Ada Quokka", email: "ada@example.test", material: "Page 4 of the numbat notes", reason: "It is my work." };

beforeEach(() => {
  for (const fn of [account, insert, rpc, update]) fn.mockReset();
  account.mockResolvedValue({ id: "me" });
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
  update.mockResolvedValue({ data: [{ id: ID }], error: null });
});

describe("reporting a problem", () => {
  it("checks the choice, note and sign-in before saving", async () => {
    expect(await reportProblem({ kind: "answer", id: ID, category: "rude" as never, note: "" })).toEqual({ ok: false, message: "Choose what is wrong." });
    expect((await reportProblem({ kind: "answer", id: ID, category: "unclear", note: "x".repeat(501) })).ok).toBe(false);
    expect((await reportProblem({ kind: "uploads" as never, id: ID, category: "unclear", note: "" })).ok).toBe(false);
    account.mockResolvedValue(null);
    expect((await reportProblem({ kind: "answer", id: ID, category: "unclear", note: "" })).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("saves a report, with an empty note left out", async () => {
    expect(await reportProblem({ kind: "brief", id: ID, category: "wrong_law", note: "  " })).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({ target_kind: "brief", target_id: ID, category: "wrong_law", note: null });
  });

  it("explains the daily limit and someone else's work", async () => {
    insert.mockResolvedValue({ error: { code: "23514" } });
    expect(await reportProblem({ kind: "answer", id: ID, category: "other", note: "" })).toMatchObject({ message: expect.stringContaining("tomorrow") });
    insert.mockResolvedValue({ error: { code: "23503" } });
    expect(await reportProblem({ kind: "answer", id: ID, category: "other", note: "" })).toMatchObject({ message: expect.stringContaining("could not be found") });
  });
});

describe("takedown requests", () => {
  it("anyone can send one, signed in or not", async () => {
    account.mockResolvedValue(null);
    expect(await submitTakedown({ status: "idle" }, form(takedown))).toEqual({ status: "sent" });
    expect(rpc).toHaveBeenCalledWith("submit_takedown", takedown);
  });

  it("says which boxes need fixing, and stores nothing", async () => {
    const result = await submitTakedown({ status: "idle" }, form({ ...takedown, email: "nope", reason: " " }));
    expect(result.status).toBe("error");
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["email", "reason"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("quietly ignores spam robots that fill the hidden box", async () => {
    expect(await submitTakedown({ status: "idle" }, form({ ...takedown, website: "spam.example" }))).toEqual({ status: "sent" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains when too many requests arrive at once", async () => {
    rpc.mockResolvedValue({ error: { code: "55000" } });
    expect(await submitTakedown({ status: "idle" }, form(takedown))).toMatchObject({ status: "error", message: expect.stringContaining("an hour") });
  });
});

describe("closing reports", () => {
  it("refuses bad ids, and says so when the database changed nothing (not a reviewer)", async () => {
    expect((await setReportStatus("not-an-id", "resolved")).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    update.mockResolvedValue({ data: [], error: null });
    expect((await setReportStatus(ID, "resolved")).ok).toBe(false);
  });
});
