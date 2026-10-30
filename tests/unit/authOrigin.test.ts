import { afterEach, describe, expect, it, vi } from "vitest";

const headerValues = new Map<string, string>();
vi.mock("next/headers", () => ({ headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }) }));

const { requestOrigin, siteOrigin } = await import("@/server/auth/origin");

// Google sign-in returns to the address the student started on, even when SITE_URL names the
// new domain; only email links use SITE_URL (founder, 2026-10-30: "Google sign-in didn't finish").
describe("sign-in addresses", () => {
  afterEach(() => {
    headerValues.clear();
    vi.unstubAllEnvs();
  });

  it("Google comes back to the address in use, not SITE_URL", async () => {
    vi.stubEnv("SITE_URL", "https://mylawdeck.com/");
    headerValues.set("x-forwarded-host", "lawdeck.vercel.app");
    headerValues.set("x-forwarded-proto", "https");
    expect(await requestOrigin()).toBe("https://lawdeck.vercel.app");
    expect(await siteOrigin()).toBe("https://mylawdeck.com");
  });

  it("email links fall back to the address in use when SITE_URL is not set", async () => {
    vi.stubEnv("SITE_URL", "");
    headerValues.set("host", "localhost:3000");
    expect(await siteOrigin()).toBe("http://localhost:3000");
  });
});
