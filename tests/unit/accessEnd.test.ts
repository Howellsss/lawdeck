import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessDaysSchema } from "@/schemas/pilot";

// A pretend admin and database: nothing real is touched. Made-up emails only.
const role = vi.fn();
const rpc = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/server/auth/roles", () => ({ getStaffRole: role }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: async () => ({ id: "admin" }) }));
vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
const { addPilotEmails, setPilotAccess } = await import("@/server/pilot/actions");

beforeEach(() => {
  role.mockReset().mockResolvedValue("admin");
  rpc.mockReset().mockResolvedValue({ data: 2, error: null });
});

describe("how long access lasts", () => {
  it("accepts 1 to 90 days, or empty for no end", () => {
    expect(accessDaysSchema.parse("")).toBeNull();
    expect(accessDaysSchema.parse(" 3 ")).toBe(3);
    for (const bad of ["0", "91", "2.5", "three"]) expect(accessDaysSchema.safeParse(bad).success).toBe(false);
  });

  it("registers emails with the number of days", async () => {
    const result = await addPilotEmails("ada@test.invalid, bola@test.invalid", "3");
    expect(rpc).toHaveBeenCalledWith("add_pilot_emails", { emails: ["ada@test.invalid", "bola@test.invalid"], days: 3 });
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining("access for 3 days") });
  });

  it("registers with no end when the box is empty, and says when emails were renewed", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    const result = await addPilotEmails("ada@test.invalid bola@test.invalid");
    expect(rpc).toHaveBeenCalledWith("add_pilot_emails", { emails: ["ada@test.invalid", "bola@test.invalid"], days: null });
    expect(result.message).toContain("1 already on the list was renewed");
  });

  it("refuses a wrong number of days before asking the database", async () => {
    expect((await addPilotEmails("ada@test.invalid", "120")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("only admins can give access, with or without days", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await setPilotAccess({ person: "aaaaaaaa-0000-4000-8000-000000000001", allow: true, days: 3 });
    expect(rpc).toHaveBeenCalledWith("set_pilot_access", { person: "aaaaaaaa-0000-4000-8000-000000000001", allow: true, days: 3 });
    role.mockResolvedValue("reviewer");
    expect((await setPilotAccess({ person: "aaaaaaaa-0000-4000-8000-000000000001", allow: true })).ok).toBe(false);
  });
});
