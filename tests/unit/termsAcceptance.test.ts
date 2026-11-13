import { beforeEach, describe, expect, it, vi } from "vitest";
import { TERMS_REQUIRED_ERROR, TERMS_VERSION } from "@/lib/terms";

// Accepting the Terms of Use and Privacy Notice (migration 67). Pretend sign-in and database.
const insert = vi.fn();
const maybeSingle = vi.fn();
const getClaims = vi.fn();
const signUpCall = vi.fn();
let account: { id: string; email: string } | null = { id: "u1", email: "ada@test.invalid" };
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: async () => account }));
vi.mock("@/server/auth/limits", () => ({ waitSeconds: async () => 0, recordAttempt: async () => {}, waitMessage: () => "" }));
vi.mock("@/server/auth/origin", () => ({ siteOrigin: async () => "https://example.com", requestOrigin: async () => "https://example.com" }));
vi.mock("@/server/auth/config", async (orig) => ({ ...(await orig()), getSupabaseConfig: () => ({ url: "x", key: "y" }) }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ insert, select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    auth: { getClaims, signUp: signUpCall },
  }),
}));
const { termsLinks, termsToAccept } = await import("@/server/account/terms");
const { acceptTerms } = await import("@/server/account/termsActions");
const { signUp } = await import("@/server/auth/actions");

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};

beforeEach(() => {
  account = { id: "u1", email: "ada@test.invalid" };
  insert.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  getClaims.mockReset().mockResolvedValue({ data: { claims: { user_metadata: {} } } });
  signUpCall.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});

describe("the documents", () => {
  it("are Lawdeck's own Terms of Service and Privacy Notice pages", () => {
    expect(termsLinks()).toEqual({ terms: "/terms", privacy: "/privacy" });
  });
});

describe("Before you continue", () => {
  it("asks someone who has not accepted the current version", async () => {
    expect(await termsToAccept()).not.toBeNull();
  });

  it("does not ask someone who already accepted it", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    expect(await termsToAccept()).toBeNull();
  });

  it("records a sign-up acceptance without asking again", async () => {
    getClaims.mockResolvedValue({ data: { claims: { user_metadata: { terms_version: TERMS_VERSION } } } });
    expect(await termsToAccept()).toBeNull();
    expect(insert).toHaveBeenCalledWith({ terms_version: TERMS_VERSION });
  });

  it("asks again when the documents change", async () => {
    getClaims.mockResolvedValue({ data: { claims: { user_metadata: { terms_version: "2000-01-01" } } } });
    expect(await termsToAccept()).not.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("asks nobody who is signed out", async () => {
    account = null;
    expect(await termsToAccept()).toBeNull();
  });

  it("needs the box ticked, then records the current version", async () => {
    expect((await acceptTerms({ status: "idle" }, form({}))).status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
    expect((await acceptTerms({ status: "idle" }, form({ agree: "yes" }))).status).toBe("idle");
    expect(insert).toHaveBeenCalledWith({ terms_version: TERMS_VERSION });
  });

  it("says so when the record is not saved", async () => {
    insert.mockResolvedValue({ error: { code: "XX000" } });
    expect(await acceptTerms({ status: "idle" }, form({ agree: "yes" }))).toMatchObject({ status: "error" });
  });
});

describe("sign-up", () => {
  const details = { name: "Ada Quokka", email: "ada@test.invalid", password: "a long enough password" };

  it("refuses without the box ticked", async () => {
    const state = await signUp({ status: "idle" }, form(details));
    expect(state.fieldErrors?.agree).toBe(TERMS_REQUIRED_ERROR);
    expect(signUpCall).not.toHaveBeenCalled();
  });

  it("keeps the accepted version with the new account", async () => {
    const state = await signUp({ status: "idle" }, form({ ...details, agree: "yes" }));
    expect(state.status).toBe("sent");
    expect(signUpCall.mock.calls[0][0].options.data).toMatchObject({ terms_version: TERMS_VERSION });
  });

});
