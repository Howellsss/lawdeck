"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/components/library/uploadFile";
import { Icon } from "@/components/ui/Icon";
import { clock, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, VOICE_TYPES, voiceFormatFor } from "@/lib/chatFiles";
import { startChatFile } from "@/server/chat/actions";
import type { Attached } from "./useAttachments";

type Stage = { s: "recording"; started: number } | { s: "review"; blob: Blob; url: string; seconds: number } | { s: "sending"; progress: number };

// Records a voice note with the phone's own microphone (no library), up to 2 minutes, then lets the
// student listen back and send or delete it. Sending uploads it to the group's private store.
export function VoiceRecorder({ groupId, apiKey, onSend, onClose }: { groupId: string; apiKey: string; onSend: (voice: Attached) => Promise<boolean>; onClose: () => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
        recorder.current = rec;
        chunks.current = [];
        const started = Date.now();
        rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
        rec.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks.current, { type: rec.mimeType });
          const seconds = Math.min(VOICE_MAX_SECONDS, Math.max(1, (Date.now() - started) / 1000));
          setStage({ s: "review", blob, url: URL.createObjectURL(blob), seconds });
        };
        rec.start(1000);
        setStage({ s: "recording", started });
      } catch {
        setError("Lawdeck can’t use your microphone. Allow microphone access for mylawdeck.com in your browser settings, then try again.");
      }
    })();
    return () => {
      cancelled = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // The timer, and the 2-minute stop.
  useEffect(() => {
    if (stage?.s !== "recording") return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() - stage.started >= VOICE_MAX_SECONDS * 1000) recorder.current?.stop();
    }, 250);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => () => void (stage?.s === "review" && URL.revokeObjectURL(stage.url)), [stage]);

  const send = async () => {
    if (stage?.s !== "review") return;
    const format = voiceFormatFor(stage.blob.type);
    if (!format) return setError("This browser records in a format Lawdeck can’t send. Try Chrome or Safari.");
    if (stage.blob.size > VOICE_MAX_BYTES) return setError("This voice note is too large. Please record a shorter one.");
    const { blob, seconds } = stage;
    setStage({ s: "sending", progress: 0 });
    const started = await startChatFile({ groupId, name: "Voice note", size: blob.size, kind: "voice", format });
    if (!started.ok) return (setError(started.message), setStage({ s: "review", blob, url: URL.createObjectURL(blob), seconds }));
    try {
      const file = new File([blob], `voice-note.${format}`, { type: VOICE_TYPES[format] });
      await uploadFile(started.signedUrl, file, apiKey, (progress) => setStage({ s: "sending", progress }));
    } catch {
      setError("The voice note didn’t upload. Check your connection and try again.");
      return setStage({ s: "review", blob, url: URL.createObjectURL(blob), seconds });
    }
    const sent = await onSend({ path: started.path, name: "Voice note", kind: "voice", size: blob.size, seconds: Math.round(seconds * 10) / 10 });
    if (sent) onClose();
    else setStage({ s: "review", blob, url: URL.createObjectURL(blob), seconds });
  };

  const button = "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium";
  return (
    <div role="group" aria-label="Voice note" className="flex flex-wrap items-center gap-2 px-3 py-2">
      {error ? (
        <p role="alert" className="flex-1 text-[14px] text-warning">
          {error}
        </p>
      ) : stage?.s === "recording" ? (
        <p className="flex flex-1 items-center gap-2 text-[15px]" aria-live="polite">
          <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-warning" />
          Recording {clock((now - stage.started) / 1000)} <span className="text-[13px] text-muted">/ {clock(VOICE_MAX_SECONDS)}</span>
        </p>
      ) : stage?.s === "review" ? (
        <audio src={stage.url} controls className="h-9 min-w-0 flex-1" aria-label="Listen back" />
      ) : stage?.s === "sending" ? (
        <p className="flex-1 text-[14px] text-muted">Sending voice note… {stage.progress}%</p>
      ) : (
        <p className="flex-1 text-[14px] text-muted">Starting the microphone…</p>
      )}
      {stage?.s === "recording" && (
        <button type="button" onClick={() => recorder.current?.stop()} className={`${button} bg-ink text-on-ink`}>
          <Icon name="stop" size={14} /> Stop
        </button>
      )}
      {stage?.s === "review" && !error && (
        <button type="button" onClick={() => void send()} className={`${button} bg-ink text-on-ink`}>
          <Icon name="send" size={14} /> Send
        </button>
      )}
      {stage?.s !== "sending" && (
        <button type="button" onClick={onClose} className={`${button} border border-line`}>
          {stage?.s === "review" ? "Delete" : "Cancel"}
        </button>
      )}
    </div>
  );
}
