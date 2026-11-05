import type { ExtrasReply } from "@/schemas/extras";
import { acronymMatches } from "./extrasRules";

type Aid = ExtrasReply["memory_aids"][number];
type Story = ExtrasReply["stories"][number];

// "Another memory aid" must cover exactly the same points as the original: the same number of
// items (none left out, merged or added), and an acronym must still be spelled by its items.
export function keepsAllPoints(original: { items: unknown[] }, candidate: Aid): boolean {
  if (candidate.items.length !== original.items.length || candidate.items.length === 0) return false;
  return candidate.kind !== "acronym" || acronymMatches(candidate);
}

// "Tell it another way" keeps the story's kind and, for a case story, the same case.
export function sameStory(original: { kind: string; authorityKey: string | null }, candidate: Story): boolean {
  if (candidate.kind !== original.kind || candidate.parts.length === 0) return false;
  return original.kind !== "case" || candidate.authority === original.authorityKey;
}
