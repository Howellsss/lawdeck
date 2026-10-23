import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend sign-in, file store and database: nothing real is touched.
const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const account = vi.fn();
const rpc = vi.fn();
const list = vi.fn();
const remove = vi.fn();
const signOut = vi.fn();
const order: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (...args: unknown[]) => (order.push("delete account"), rpc(...args)),
    auth: { signOut },
    storage: { from: () => ({ list, remove: async (paths: string[]) => (order.push("remove files"), remove(paths)) }) },
  }),
}));
const { deleteAccount } = await import("@/server/account/actions");

const form = (confirm: string) => {
  const data = new FormData();
  data.set("confirm", confirm);
  return data;
};

beforeEach(() => {
  for (const fn of [account, rpc, list, remove, signOut]) fn.mockReset();
  order.length = 0;
  account.mockResolvedValue({ id: USER, email: "a@test.invalid" });
  rpc.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  list.mockResolvedValueOnce({ data: [{ name: "f1.pdf" }, { name: "f2.png" }], error: null }).mockResolvedValue({ data: [], error: null });
});

describe("deleting an account", () => {
  it("needs DELETE typed and a signed-in student, before anything is removed", async () => {
    expect(await deleteAccount({ status: "idle" }, form("delete"))).toEqual({ status: "error", message: "Type DELETE in capitals to confirm." });
    account.mockResolvedValue(null);
    expect((await deleteAccount({ status: "idle" }, form("DELETE"))).status).toBe("error");
    expect(order).toEqual([]);
  });

  it("removes the student's own files first, then the account, then signs out", async () => {
    await expect(deleteAccount({ status: "idle" }, form("DELETE"))).rejects.toThrow("redirect:/account-deleted");
    expect(remove).toHaveBeenCalledWith([`${USER}/f1.pdf`, `${USER}/f2.png`]);
    expect(order).toEqual(["remove files", "delete account"]);
    expect(rpc).toHaveBeenCalledWith("delete_my_account", { confirm: "DELETE" });
    expect(signOut).toHaveBeenCalled();
  });

  it("keeps the account and says so if the files could not be removed", async () => {
    remove.mockResolvedValue({ error: { name: "StorageError" } });
    expect(await deleteAccount({ status: "idle" }, form("DELETE"))).toEqual({
      status: "error",
      message: "Your account was not deleted. Please try again.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains that staff accounts are removed by the founder", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "Reviewer and admin accounts are removed by the founder." } });
    expect(await deleteAccount({ status: "idle" }, form("DELETE"))).toEqual({
      status: "error",
      message: "Reviewer and admin accounts are removed by the founder.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
