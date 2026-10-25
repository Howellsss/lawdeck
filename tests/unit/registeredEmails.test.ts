import { describe, expect, it } from "vitest";
import { REGISTER_EMAILS_MAX, registerEmailsSchema } from "@/schemas/pilot";

describe("registering testers' emails", () => {
  it("accepts one email, tidied to lower case", () => {
    expect(registerEmailsSchema.parse("  Ada.Obi@Gmail.com ")).toEqual(["ada.obi@gmail.com"]);
  });

  it("accepts several, on lines or with commas, without repeats", () => {
    expect(registerEmailsSchema.parse("ada@gmail.com, bola@gmail.com\nADA@gmail.com;  chi@yahoo.com")).toEqual([
      "ada@gmail.com",
      "bola@gmail.com",
      "chi@yahoo.com",
    ]);
  });

  it("names the entry that is not an email", () => {
    const result = registerEmailsSchema.safeParse("ada@gmail.com, bola-at-gmail");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("bola-at-gmail");
  });

  it("refuses an empty box, and more than the limit at once", () => {
    expect(registerEmailsSchema.safeParse("  , \n").success).toBe(false);
    const many = Array.from({ length: REGISTER_EMAILS_MAX + 1 }, (_, i) => `t${i}@gmail.com`).join(",");
    expect(registerEmailsSchema.safeParse(many).success).toBe(false);
  });
});
