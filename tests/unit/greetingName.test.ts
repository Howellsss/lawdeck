import { beforeEach, describe, expect, it, vi } from "vitest";
import { firstName } from "@/lib/greeting";

const account = vi.fn();
const update = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ update: (row: unknown) => ({ eq: async () => update(row) }) }),
  }),
}));
const { saveOwnName } = await import("@/server/account/nameActions");
const form = (name: string) => {
  const data = new FormData();
  data.set("name", name);
  return data;
};

describe("first name for the greeting", () => {
  it("takes the first word of a full name", () => {
    expect(firstName("  Ada   Quokka ")).toBe("Ada");
    expect(firstName("Ọlá Adé")).toBe("Ọlá");
  });
  it("gives nothing for an empty or letter-less name", () => {
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
    expect(firstName("  123 ")).toBeNull();
  });
});

describe("saving your name", () => {
  beforeEach(() => {
    account.mockReset().mockResolvedValue({ id: "me", email: "a@test.invalid" });
    update.mockReset().mockResolvedValue({ error: null });
  });

  it("saves a tidied name, and an empty box clears it", async () => {
    expect(await saveOwnName({ status: "idle" }, form("  Ada   Quokka "))).toEqual({ status: "saved", name: "Ada Quokka" });
    expect(update).toHaveBeenLastCalledWith({ full_name: "Ada Quokka" });
    await saveOwnName({ status: "idle" }, form("   "));
    expect(update).toHaveBeenLastCalledWith({ full_name: null });
  });

  it("needs sign-in and a name of 80 characters or fewer", async () => {
    expect((await saveOwnName({ status: "idle" }, form("x".repeat(81)))).status).toBe("error");
    account.mockResolvedValue(null);
    expect((await saveOwnName({ status: "idle" }, form("Ada"))).status).toBe("error");
    expect(update).not.toHaveBeenCalled();
  });
});
