"use client";

import { useState } from "react";
import { CallView, type CallPerson } from "@/components/chat/call/CallView";

const others: CallPerson[] = [
  { id: "t", name: "Tunde Quokka", me: false, speaking: true, micOn: true, video: null },
  { id: "b", name: "Bisi Numbat", me: false, speaking: false, micOn: false, video: null },
];

// The call screen with made-up people; the buttons only change what is shown.
export function CallDemo() {
  const [micOn, setMicOn] = useState(true);
  const [left, setLeft] = useState(false);
  if (left) return <p role="status">You left the call.</p>;
  const people = [{ id: "a", name: "Ada Wombat", me: true, speaking: false, micOn, video: null }, ...others];
  return (
    <CallView
      people={people}
      micOn={micOn}
      cameraOn={false}
      busy={false}
      needsAudioTap
      onMic={() => setMicOn((v) => !v)}
      onCamera={() => undefined}
      onLeave={() => setLeft(true)}
      onStartAudio={() => undefined}
    />
  );
}
