"use client";

import type { Participant, Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { callHeartbeat, leaveCall } from "@/server/chat/calls";
import type { CallPerson } from "./CallView";

const CHECK_IN_EVERY = 30_000;

const ENDED: Record<string, string> = {
  budget: "The call ended: group calls are full for this month. They’re back on the 1st.",
  too_long: "The call ended: calls last up to 3 hours. Start a new one to keep going.",
  end: "You left the call.",
};

// Connects to a study group call (LiveKit's browser code loads only now, not with the page): the
// microphone on and the camera off, the others' audio played, a check-in every 30 seconds, and
// leaving cleanly. The server can end the call for everyone (monthly limit or 3 hours).
export function useLiveKitCall(pass: { callId: string; url: string; token: string }, onEnded: (notice?: string) => void) {
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement | null>(null);
  const [people, setPeople] = useState<CallPerson[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const ended = useRef(false);

  // Ending the call: the screen changes at once; hanging up and telling Lawdeck finish in the
  // background (they can take a few seconds on a slow connection).
  const finish = useCallback(
    (why?: string) => {
      if (ended.current) return;
      ended.current = true;
      const r = room.current;
      room.current = null;
      onEnded(why);
      void r?.disconnect().catch(() => undefined);
      void leaveCall({ callId: pass.callId });
    },
    [onEnded, pass.callId],
  );

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    ended.current = false;
    const holder = document.createElement("div");
    holder.hidden = true;
    document.body.append(holder);
    audio.current = holder;
    (async () => {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (cancelled || ended.current) return;
      const r = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 24 } } });
      room.current = r;
      const person = (p: Participant, me: boolean): CallPerson => {
        const cam = p.getTrackPublication(Track.Source.Camera);
        const track = cam && !cam.isMuted ? cam.track : undefined;
        return {
          id: p.identity,
          name: p.name || "Lawdeck student",
          me,
          speaking: p.isSpeaking,
          micOn: p.isMicrophoneEnabled,
          video: track ? { attach: (el) => void track.attach(el), detach: (el) => void track.detach(el) } : null,
        };
      };
      const update = () => setPeople([person(r.localParticipant, true), ...[...r.remoteParticipants.values()].map((p) => person(p, false))]);
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) holder.append(track.attach());
        update();
      })
        .on(RoomEvent.TrackUnsubscribed, (track) => (track.detach().forEach((el) => el.remove()), update()))
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioTap(!r.canPlaybackAudio));
      for (const e of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged, RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished] as const) r.on(e, update);
      r.on(RoomEvent.Disconnected, () => finish("The call ended."));
      try {
        await r.connect(pass.url, pass.token);
      } catch {
        if (!cancelled) finish("The call couldn’t connect. Check your internet, then try again.");
        return;
      }
      // Left while connecting: hang up now.
      if (cancelled || ended.current) {
        void r.disconnect();
        return;
      }
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
      } catch {
        setMicOn(false);
        setNotice("Allow the microphone in your browser to talk. You can still listen.");
      }
      setNeedsAudioTap(!r.canPlaybackAudio);
      setBusy(false);
      update();
      timer = window.setInterval(async () => {
        const result = await callHeartbeat({ callId: pass.callId });
        if (result !== "ok") finish(ENDED[result]);
      }, CHECK_IN_EVERY);
    })();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (!ended.current) {
        ended.current = true;
        void room.current?.disconnect();
        void leaveCall({ callId: pass.callId });
      }
      holder.remove();
    };
  }, [finish, pass]);

  const toggleMic = async () => {
    const r = room.current;
    if (!r) return;
    try {
      await r.localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
      setNotice(undefined);
    } catch {
      setNotice("Allow the microphone in your browser to talk.");
    }
  };
  const toggleCamera = async () => {
    const r = room.current;
    if (!r) return;
    try {
      await r.localParticipant.setCameraEnabled(!cameraOn);
      setCameraOn(!cameraOn);
      setNotice(undefined);
    } catch {
      setNotice("Allow the camera in your browser to turn it on.");
    }
  };
  const startAudio = () => void room.current?.startAudio().then(() => setNeedsAudioTap(false));

  return { people, micOn, cameraOn, busy, notice, needsAudioTap, toggleMic, toggleCamera, startAudio, leave: () => finish("You left the call.") };
}
