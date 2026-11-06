import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { joinToken, liveKitConfig, signToken } from "@/server/chat/livekit";

// Made-up keys only.
const config = { url: "wss://lawdeck-test.livekit.cloud", apiUrl: "https://lawdeck-test.livekit.cloud", key: "APItest", secret: "secret-for-tests-only" };
const parts = (token: string) => token.split(".");
const payload = (token: string) => JSON.parse(Buffer.from(parts(token)[1], "base64url").toString());

describe("LiveKit passes for study group calls", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless all three settings are present and the address is secure", () => {
    vi.stubEnv("LIVEKIT_URL", "wss://lawdeck-test.livekit.cloud");
    vi.stubEnv("LIVEKIT_API_KEY", "APItest");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(liveKitConfig()).toBeNull();
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    expect(liveKitConfig()?.apiUrl).toBe("https://lawdeck-test.livekit.cloud");
    vi.stubEnv("LIVEKIT_URL", "ws://lawdeck-test.livekit.cloud");
    expect(liveKitConfig()).toBeNull();
  });

  it("signs passes with the secret, so they cannot be forged", () => {
    const token = signToken(config, { sub: "x" }, 60, 1_700_000_000_000);
    const [head, body, sig] = parts(token);
    expect(sig).toBe(createHmac("sha256", config.secret).update(`${head}.${body}`).digest("base64url"));
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload(token)).toMatchObject({ iss: "APItest", sub: "x", nbf: 1_700_000_000, exp: 1_700_000_060 });
  });

  it("gives a student one room only: speak, camera and listen; no admin rights; 10 minutes to join", () => {
    const token = joinToken(config, "lawdeck-call-1", "user-1", "Ada Wombat", 1_700_000_000_000);
    const p = payload(token);
    expect(p).toMatchObject({ sub: "user-1", name: "Ada Wombat", exp: 1_700_000_600 });
    expect(p.video).toEqual({
      room: "lawdeck-call-1",
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ["microphone", "camera"],
    });
    expect(p.video.roomAdmin).toBeUndefined();
    expect(p.video.roomRecord).toBeUndefined();
    expect(token).not.toContain(config.secret);
  });
});
