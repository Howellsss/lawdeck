import { describe, expect, it } from "vitest";
import { GENERIC_AUTH_ERROR, messageForAuthError } from "@/server/auth/errors";

describe("sign-in error messages", () => {
  it("gives a plain message for known Supabase codes", () => {
    expect(messageForAuthError("invalid_credentials")).toMatch(/don’t match/);
    expect(messageForAuthError("over_request_rate_limit")).toMatch(/Wait a few minutes/);
  });

  it("falls back to a general message for unknown or missing codes", () => {
    expect(messageForAuthError("something_new")).toBe(GENERIC_AUTH_ERROR);
    expect(messageForAuthError(undefined)).toBe(GENERIC_AUTH_ERROR);
  });

  it("never reveals whether an account exists", () => {
    expect(messageForAuthError("invalid_credentials")).not.toMatch(/no account|not registered|not found/i);
  });
});
