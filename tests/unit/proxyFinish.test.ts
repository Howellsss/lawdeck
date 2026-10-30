import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalRedirect, signInToFinish } from "@/proxy";

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

describe("one address for the live site", () => {
  afterEach(() => vi.unstubAllEnvs());
  const visit = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

  it("moves visits to the old live address to mylawdeck.com, keeping the page and code", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SITE_URL", "https://mylawdeck.com");
    expect(canonicalRedirect(visit("https://lawdeck.vercel.app/?code=abc"))?.href).toBe("https://mylawdeck.com/?code=abc");
    expect(canonicalRedirect(visit("https://lawdeck.vercel.app/courses/civil"))?.href).toBe("https://mylawdeck.com/courses/civil");
    expect(canonicalRedirect(visit("https://mylawdeck.com/courses"))).toBeNull();
  });

  it("never sends a visitor to another website, whatever the path", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SITE_URL", "https://mylawdeck.com");
    const request = visit("https://lawdeck.vercel.app/x");
    Object.defineProperty(request.nextUrl, "pathname", { value: "//evil.example/steal" });
    expect(canonicalRedirect(request)?.host).toBe("mylawdeck.com");
  });

  it("never moves preview copies or local runs", () => {
    vi.stubEnv("SITE_URL", "https://mylawdeck.com");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(canonicalRedirect(visit("https://lawdeck-git-x.vercel.app/"))).toBeNull();
    vi.stubEnv("VERCEL_ENV", "");
    expect(canonicalRedirect(visit("http://localhost:3000/"))).toBeNull();
  });
});
