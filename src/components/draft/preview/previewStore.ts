"use client";

import { useSyncExternalStore } from "react";
import type { EditablePartView } from "@/server/db/documents";
import type { DocModel } from "@/server/documents/render";

// The document the right panel is showing. The panel's content is set once when it opens; this
// store lets every saved change (and a version being looked at) reach it straight away.
export type PreviewState = {
  model: DocModel | null;
  // Shown above the pages, e.g. "Version 2 (not current)".
  caption?: string;
  // Clicking a placeholder opens the matching question (field) or part (no field).
  onPlaceholder?: (target: { field?: string; partId: string }) => void;
  // Set for the current version only: clicking a paragraph on a page edits that part's wording.
  editing?: { documentId: string; parts: EditablePartView[] };
};

let state: PreviewState = { model: null };
const listeners = new Set<() => void>();

export function setPreview(next: PreviewState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function usePreview(): PreviewState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
