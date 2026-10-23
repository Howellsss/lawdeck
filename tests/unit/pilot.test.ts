import { describe, expect, it } from "vitest";
import { CLOSED_PILOT_MESSAGE, limitReachedMessage } from "@/lib/allowance";
import { generateInviteCode } from "@/lib/inviteCode";
import { inviteCodeSchema, newInviteSchema, pilotSettingsSchema } from "@/schemas/pilot";

// The closed pilot (Phase 8). Database rules: tests/permissions/sql/9i_closed_pilot_test.sql.

describe("invite codes", () => {
  it("are 10 easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
  });

  it("skip random bytes that would make some characters more likely", () => {
    // 248 and above would favour the first characters, so they are thrown away.
    let call = 0;
    const random = (bytes: Uint8Array) => bytes.fill(call++ === 0 ? 255 : 0);
    expect(generateInviteCode(random)).toBe("AAAAAAAAAA");
    expect(call).toBe(2);
  });

  it("accept what students type: spaces, dashes and small letters", () => {
    expect(inviteCodeSchema.parse(" k7mpq-2rxta ")).toBe("K7MPQ2RXTA");
    expect(inviteCodeSchema.safeParse("K7MPQ2RXT0").success).toBe(false);
    expect(inviteCodeSchema.safeParse("short").success).toBe(false);
  });

  it("are created for a named group, with limits", () => {
    expect(newInviteSchema.parse({ label: " Resit  group A ", maxUses: "20", expiresInDays: "" })).toEqual({ label: "Resit group A", maxUses: 20, expiresInDays: null });
    expect(newInviteSchema.safeParse({ label: "", maxUses: "20", expiresInDays: "30" }).success).toBe(false);
    expect(newInviteSchema.safeParse({ label: "A", maxUses: "501", expiresInDays: "30" }).success).toBe(false);
    expect(newInviteSchema.safeParse({ label: "A", maxUses: "5", expiresInDays: "91" }).success).toBe(false);
  });
});

describe("pilot settings", () => {
  it("need a price before the price question opens", () => {
    expect(pilotSettingsSchema.safeParse({ inviteOnly: true, priceQuestionOpen: true, priceNgn: "" }).success).toBe(false);
    expect(pilotSettingsSchema.parse({ inviteOnly: true, priceQuestionOpen: true, priceNgn: "₦2,500" }).priceNgn).toBe(2500);
  });
});

describe("students without an invite code", () => {
  it("are told how to join instead of being told they used their questions", () => {
    expect(limitReachedMessage({ used: 0, limit: 0, unlimited: false })).toBe(CLOSED_PILOT_MESSAGE);
    expect(limitReachedMessage({ used: 30, limit: 30, unlimited: false })).not.toBe(CLOSED_PILOT_MESSAGE);
  });
});
