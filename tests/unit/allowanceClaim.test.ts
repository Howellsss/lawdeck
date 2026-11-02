import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({}) }));
const { getAllowance } = await import("@/server/learn/allowance");

const row = (limit: number) => ({ used: 0, monthly_limit: limit, unlimited: false, window_used: null, window_limit: null, window_resets_at: null });

// A fake database: question_allowance answers from the list in turn; claim_pilot_invite answers `claim`.
function fakeDb(limits: number[], claim: string) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_pilot_invite") return { data: claim, error: null };
    return { data: [row(limits.shift() ?? 0)], error: null };
  });
  return { rpc, db: { rpc } as unknown as SupabaseClient<Database> };
}

describe("a registered tester gets access without the invite link (migration 44)", () => {
  it("claims access when there are no questions yet, then reads the allowance again", async () => {
    const { rpc, db } = fakeDb([0, 50], "ok");
    expect((await getAllowance(db))?.limit).toBe(50);
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["question_allowance", "claim_pilot_invite", "question_allowance"]);
  });

  it("keeps the closed allowance when the email is not registered", async () => {
    const { rpc, db } = fakeDb([0], "not_registered");
    expect((await getAllowance(db))?.limit).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("does not claim when the student already has questions", async () => {
    const { rpc, db } = fakeDb([50], "ok");
    expect((await getAllowance(db))?.limit).toBe(50);
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["question_allowance"]);
  });
});
