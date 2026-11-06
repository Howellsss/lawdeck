"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { clock } from "@/lib/chatFiles";

const SPEEDS = [1, 1.5, 2] as const;

// A voice note in a message: play or pause, how far along, its length and the playback speed.
export function VoiceNote({ url, seconds, label = "Voice note" }: { url: string | null; seconds: number; label?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [duration, setDuration] = useState(0);
  const length = seconds || duration;
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const nextSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  if (!url) return <p className="text-[13px] text-muted">Voice note · {clock(seconds)} · not available</p>;
  return (
    <div className="flex w-72 max-w-[75vw] items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2" role="group" aria-label={`${label}, ${clock(seconds)}`}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (setPlaying(false), setAt(0))}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink"
      >
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-pill" aria-hidden>
          <div className="h-full rounded-full bg-ink" style={{ width: `${length ? Math.min(100, (at / length) * 100) : 0}%` }} />
        </div>
        <span className="text-[12px] tabular-nums text-muted">
          {playing || at > 0 ? clock(at) : clock(seconds)}
        </span>
      </div>
      <button type="button" onClick={nextSpeed} aria-label={`Playback speed ${speed}x`} className="rounded-md border border-line px-1.5 py-0.5 text-[12px] font-medium tabular-nums">
        {speed}x
      </button>
    </div>
  );
}
