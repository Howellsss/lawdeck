import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { signInToFinish } from "@/proxy";

// Google sign-in that lands on another page with its one-time code is finished by the callback,
// instead of leaving the student signed out (founder, 2026-10-30: "it gets in and requires me to
// log in again").
describe("finishing Google sign-in from any page", () => {
  it("sends a code that landed on the home page to the callback", () => {
    const target = signInToFinish(new NextRequest("https://mylawdeck.com/?code=abc123"));
    expect(target?.pathname).toBe("/auth/callback");
    expect(target?.searchParams.get("code")).toBe("abc123");
    expect(target?.searchParams.get("next")).toBe("/");
    expect(target?.origin).toBe("https://mylawdeck.com");
  });

  it("keeps the page and its other details to return to afterwards", () => {
    const target = signInToFinish(new NextRequest("https://mylawdeck.com/courses/civil?code=x&tab=topics"));
    expect(target?.searchParams.get("next")).toBe("/courses/civil?tab=topics");
  });

  it("leaves the callback itself, the API and pages without a code alone", () => {
    expect(signInToFinish(new NextRequest("https://mylawdeck.com/auth/callback?code=x"))).toBeNull();
    expect(signInToFinish(new NextRequest("https://mylawdeck.com/api/chats/1/answer?code=x"))).toBeNull();
    expect(signInToFinish(new NextRequest("https://mylawdeck.com/courses"))).toBeNull();
  });
});
