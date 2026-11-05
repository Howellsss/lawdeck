"use client";

import { useState } from "react";
import { MemoryAidCard } from "@/components/lessons/MemoryAidCard";
import { anotherAid, saveMadeAid, type MadeAid } from "@/server/study/again";

// "Another memory aid" (founder's brief: "Allow students to generate alternative mnemonics"):
// the same points, a different device, made on request from the reviewed lesson and checked
// against the library. Uses one question. The student can save the one they like.
export function AnotherAid({ aidId }: { aidId: string }) {
  const [made, setMade] = useState<{ aid: MadeAid; topicId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  async function make() {
    setBusy(true);
    setError(undefined);
    const result = await anotherAid({ aidId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setMade({ aid: result.aid, topicId: result.topicId });
    setSaved(false);
  }

  async function save() {
    if (!made) return;
    const result = await saveMadeAid(made);
    if (!result.ok) return setError(result.message);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-2">
      {made && (
        <MemoryAidCard
          aid={made.aid}
          madeForYou
          actions={
            <button
              type="button"
              disabled={saved}
              onClick={() => void save()}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${saved ? "border-success text-success" : "border-line"}`}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" disabled={busy} onClick={() => void make()} className="text-muted underline underline-offset-2 disabled:opacity-60">
          {busy ? "Making another one…" : made ? "Try another one" : "Another memory aid"}
        </button>
        <span className="text-muted">uses one question</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
    </div>
  );
}
