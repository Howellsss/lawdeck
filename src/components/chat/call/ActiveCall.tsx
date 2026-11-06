"use client";

import { CallView } from "./CallView";
import { useLiveKitCall } from "./useLiveKitCall";

// The call the student is in.
export function ActiveCall({ pass, onEnded }: { pass: { callId: string; url: string; token: string }; onEnded: (notice?: string) => void }) {
  const call = useLiveKitCall(pass, onEnded);
  return (
    <CallView
      people={call.people}
      micOn={call.micOn}
      cameraOn={call.cameraOn}
      busy={call.busy}
      notice={call.notice}
      needsAudioTap={call.needsAudioTap}
      onMic={() => void call.toggleMic()}
      onCamera={() => void call.toggleCamera()}
      onLeave={call.leave}
      onStartAudio={call.startAudio}
    />
  );
}
