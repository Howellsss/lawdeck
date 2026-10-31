import { describe, expect, it } from "vitest";
import { emailLinkTypeSchema, signInSchema, signUpSchema } from "@/schemas/auth";

describe("sign-up rules", () => {
  it("accepts a normal email and a 10-character password, tidying the email", () => {
    const result = signUpSchema.safeParse({ name: " Ada  Obi ", email: "  Ada@Example.COM ", password: "abcdefghij" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ada@example.com");
    expect(result.data?.name).toBe("Ada Obi");
  });

  it("asks for a name, so Lawdeck can greet the student by it", () => {
    const missing = signUpSchema.safeParse({ name: "   ", email: "ada@example.com", password: "abcdefghij" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toBe("Enter your name.");
    expect(signUpSchema.safeParse({ name: "a".repeat(81), email: "ada@example.com", password: "abcdefghij" }).success).toBe(false);
  });

  it("rejects passwords shorter than 10 characters (rule C-03)", () => {
    const result = signUpSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Use at least 10 characters.");
  });

  it("rejects passwords over 72 characters", () => {
    expect(signUpSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "a".repeat(73) }).success).toBe(false);
  });

  it.each(["", "not-an-email", "ada@", "@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects the email %j",
    (email) => {
      expect(signUpSchema.safeParse({ name: "Ada", email, password: "abcdefghij" }).success).toBe(false);
    },
  );

  it("rejects missing or non-text fields", () => {
    expect(signUpSchema.safeParse({}).success).toBe(false);
    expect(signUpSchema.safeParse({ email: 5, password: null }).success).toBe(false);
  });
});

describe("sign-in rules", () => {
  it("only requires a password to be present", () => {
    expect(signInSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });
});

describe("email link types", () => {
  it("allows Supabase's link types and nothing else", () => {
    expect(emailLinkTypeSchema.safeParse("recovery").success).toBe(true);
    expect(emailLinkTypeSchema.safeParse("signup").success).toBe(true);
    expect(emailLinkTypeSchema.safeParse("admin").success).toBe(false);
  });
});
