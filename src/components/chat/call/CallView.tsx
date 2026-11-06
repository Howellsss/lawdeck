"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

// What a call looks like, whatever connects it: a tile per person (their video when their camera
// is on, otherwise their initials, with a ring while they speak), and the controls. Audio first:
// everyone joins with the camera off.

export type CallPerson = { id: string; name: string; me: boolean; speaking: boolean; micOn: boolean; video: { attach: (el: HTMLVideoElement) => void; detach: (el: HTMLVideoElement) => void } | null };

const control = "flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-line px-4 text-[14px] font-medium hover:bg-pill disabled:opacity-50";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "L") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function Tile({ person }: { person: CallPerson }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    const track = person.video;
    if (!el || !track) return;
    track.attach(el);
    return () => track.detach(el);
  }, [person.video]);
  return (
    <li
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-surface ${person.speaking ? "border-ink ring-2 ring-ink" : "border-line"}`}
      aria-label={`${person.name}${person.me ? " (you)" : ""}${person.speaking ? ", speaking" : ""}${person.micOn ? "" : ", muted"}`}
    >
      {person.video ? (
        <video ref={video} autoPlay playsInline muted={person.me} className="size-full object-cover" />
      ) : (
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-pill text-lg font-semibold">
          {initials(person.name)}
        </span>
      )}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[90%] items-center gap-1 rounded-md bg-paper/90 px-1.5 py-0.5 text-[12px]">
        {!person.micOn && <Icon name="micOff" size={12} />}
        <span className="truncate">{person.me ? `${person.name} (you)` : person.name}</span>
      </span>
    </li>
  );
}

export function CallView({
  people,
  micOn,
  cameraOn,
  busy,
  notice,
  needsAudioTap,
  onMic,
  onCamera,
  onLeave,
  onStartAudio,
}: {
  people: CallPerson[];
  micOn: boolean;
  cameraOn: boolean;
  busy: boolean;
  notice?: string;
  needsAudioTap: boolean;
  onMic: () => void;
  onCamera: () => void;
  onLeave: () => void;
  onStartAudio: () => void;
}) {
  return (
    <section aria-label="Group call" className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:px-6">
      <p className="text-[13px] text-muted">
        📞 Group call · {busy && people.length === 0 ? "connecting…" : `${people.length} ${people.length === 1 ? "person" : "people"}`} · not recorded
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {people.map((p) => (
          <Tile key={p.id} person={p} />
        ))}
      </ul>
      {notice && (
        <p role="alert" className="text-[14px] text-warning">
          {notice}
        </p>
      )}
      {needsAudioTap && (
        <button type="button" onClick={onStartAudio} className={`${control} w-fit`}>
          <Icon name="speaker" size={18} /> Tap to hear the call
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onMic} disabled={busy} aria-pressed={!micOn} className={control}>
          <Icon name={micOn ? "mic" : "micOff"} size={18} /> {micOn ? "Mute" : "Unmute"}
        </button>
        <button type="button" onClick={onCamera} disabled={busy} aria-pressed={cameraOn} className={control}>
          <Icon name={cameraOn ? "videoOff" : "video"} size={18} /> {cameraOn ? "Camera off" : "Camera on"}
        </button>
        <button type="button" onClick={onLeave} className={`${control} bg-ink text-on-ink hover:bg-ink`}>
          <Icon name="phone" size={18} /> Leave
        </button>
      </div>
    </section>
  );
}
