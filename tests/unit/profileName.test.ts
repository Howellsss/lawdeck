import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { saved: string | null; meta: Record<string, unknown> | null } = { saved: null, meta: null };
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: async () => ({ id: "u1", email: "ada@example.com" }) }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: state.saved }, error: null }) }) }) }),
    auth: { getClaims: async () => ({ data: { claims: { user_metadata: state.meta } } }) },
  }),
}));

const { getFullName, getGreetingName } = await import("@/server/db/profile");

// The name a student is greeted by and can change on the Account page (founder, 2026-10-31).
describe("the student's name", () => {
  beforeEach(() => {
    state.saved = null;
    state.meta = null;
  });

  it("uses the name saved on the Account page first, so a changed name wins", async () => {
    state.saved = "Sharon Okwu";
    state.meta = { full_name: "Sharon Blessed" };
    expect(await getFullName()).toBe("Sharon Okwu");
    expect(await getGreetingName()).toBe("Sharon");
  });

  it("otherwise uses the name given at sign-up (the form, or Google)", async () => {
    state.meta = { full_name: "  Sharon Blessed  " };
    expect(await getFullName()).toBe("Sharon Blessed");
    state.meta = { name: "Ada Obi" };
    expect(await getGreetingName()).toBe("Ada");
  });

  it("has no name when none was ever given", async () => {
    expect(await getFullName()).toBeNull();
    expect(await getGreetingName()).toBeNull();
  });
});
