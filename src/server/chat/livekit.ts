import "server-only";
import { createHmac } from "node:crypto";

// LiveKit Cloud for group calls in study groups (docs/specs/chat.md, step 4f). The keys stay on the
// server (Vercel settings); students get a short-lived pass for one room, made here with Node's own
// signing (no extra library). Calls are never recorded: no recording is ever requested.

export type LiveKitConfig = { url: string; apiUrl: string; key: string; secret: string };

export function liveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret || !/^wss:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(url)) return null;
  return { url: url.replace(/\/$/, ""), apiUrl: url.replace(/^wss:/i, "https:").replace(/\/$/, ""), key, secret };
}

// Whether group calls are switched on (all three LiveKit settings are present).
export function callsEnabled(): boolean {
  return liveKitConfig() !== null;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

// A signed pass (JSON Web Token, HS256) in LiveKit's format.
export function signToken(config: Pick<LiveKitConfig, "key" | "secret">, claims: Record<string, unknown>, seconds: number, now = Date.now()): string {
  const at = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: config.key, nbf: at, exp: at + seconds, ...claims }));
  const sig = createHmac("sha256", config.secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

// A student's pass for one room: speak, turn the camera on and listen; nothing else. It is for
// joining within 10 minutes; LiveKit keeps a connected student in the call after that.
export function joinToken(config: LiveKitConfig, room: string, identity: string, name: string, now?: number): string {
  return signToken(
    config,
    {
      sub: identity,
      name,
      video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: ["microphone", "camera"] },
    },
    600,
    now,
  );
}

async function roomService(config: LiveKitConfig, method: "CreateRoom" | "DeleteRoom", room: string, body: Record<string, unknown>): Promise<boolean> {
  const token = signToken(config, { video: { room, roomCreate: true, roomAdmin: true } }, 60);
  try {
    const res = await fetch(`${config.apiUrl}/twirp/livekit.RoomService/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// The room for a call: at most 15 people; it closes 2 minutes after everyone has left.
export function createRoom(config: LiveKitConfig, room: string): Promise<boolean> {
  return roomService(config, "CreateRoom", room, { name: room, empty_timeout: 120, departure_timeout: 30, max_participants: 15 });
}

// Ends a call for everyone (the monthly limit was reached, or it ran for 3 hours).
export function deleteRoom(config: LiveKitConfig, room: string): Promise<boolean> {
  return roomService(config, "DeleteRoom", room, { room });
}
