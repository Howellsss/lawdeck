"use client";

import { useState } from "react";
import { ActiveCall } from "@/components/chat/call/ActiveCall";

// 10.255.255.1 is never reachable, so the call stays "connecting" until the student leaves.
const pass = { callId: "00000000-0000-4000-8000-000000000892", url: "wss://10.255.255.1", token: "test" };

export function LiveCallDemo() {
  const [note, setNote] = useState<string | null>(null);
  if (note !== null) return <p role="status">{note || "Call ended."}</p>;
  return <ActiveCall pass={pass} onEnded={(why) => setNote(why ?? "")} />;
}
