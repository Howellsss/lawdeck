import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend Supabase and request: nothing real is touched. Made-up addresses only.
const rpc = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));
vi.mock("@/server/auth/config", () => ({ getSupabaseConfig: () => ({ url: "x", key: "y" }), isGoogleSignInEnabled: () => false }));
vi.mock("@/server/auth/origin", () => ({ siteOrigin: async () => "https://lawdeck.test" }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({ rpc, auth: { signInWithPassword, resetPasswordForEmail } }),
}));
const { signIn, requestPasswordReset } = await import("@/server/auth/actions");
const { scramble, waitMessage } = await import("@/server/auth/limits");

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const login = form({ email: "Ada@Example.test", password: "a long made-up password" });

beforeEach(() => {
  for (const fn of [rpc, signInWithPassword, resetPasswordForEmail]) fn.mockReset();
  rpc.mockResolvedValue({ data: 0, error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe("scrambling", () => {
  it("never sends the real email or address, and treats capitals and spaces alike", () => {
    expect(scramble(" Ada@Example.test ")).toBe(scramble("ada@example.test"));
    expect(scramble("ada@example.test")).toMatch(/^[0-9a-f]{64}$/);
    expect(scramble("ada@example.test")).not.toContain("ada");
  });
});

describe("sign-in", () => {
  it("pauses without trying the password once the limit is reached", async () => {
    rpc.mockResolvedValue({ data: 600, error: null });
    expect(await signIn({ status: "idle" }, login)).toMatchObject({ status: "error", message: "Too many attempts. Please wait 10 minutes and try again." });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("counts a wrong password, scrambled", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    await signIn({ status: "idle" }, login);
    expect(rpc).toHaveBeenLastCalledWith("record_auth_attempt", {
      kind: "sign_in_failed",
      email_hash: scramble("ada@example.test"),
      ip_hash: scramble("203.0.113.7"),
    });
  });

  it("does not count a correct password", async () => {
    await expect(signIn({ status: "idle" }, login)).rejects.toThrow("redirect:");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["auth_wait_seconds"]);
  });

  it("still lets people sign in if the limit check itself fails (Supabase's limits remain)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(signIn({ status: "idle" }, login)).rejects.toThrow("redirect:");
  });
});

describe("password reset", () => {
  it("counts each request and stops once the limit is reached", async () => {
    await requestPasswordReset({ status: "idle" }, form({ email: "ada@example.test" }));
    expect(rpc.mock.calls.map((c) => [c[0], c[1].kind])).toEqual([
      ["auth_wait_seconds", "reset"],
      ["record_auth_attempt", "reset"],
    ]);
    rpc.mockResolvedValue({ data: 3000, error: null });
    resetPasswordForEmail.mockClear();
    expect((await requestPasswordReset({ status: "idle" }, form({ email: "ada@example.test" }))).message).toBe(waitMessage(3000));
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
