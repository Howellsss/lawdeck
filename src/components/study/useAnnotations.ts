"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { placeAnnotation, type Annotation, type AnnotationStyle, type Placed } from "@/lib/annotations";
import type { LessonContent } from "@/schemas/lesson";
import { addAnnotation, changeAnnotation, removeAnnotation } from "@/server/study/annotations";

export type Pending = { section: number; paragraph: number; start: number; end: number; quote: string };

// Where a selection inside the lesson starts and ends, measured from the data-o marks LessonBody
// puts on every piece of text. Only within one paragraph, and up to 500 characters.
function readSelection(root: HTMLElement, content: LessonContent): Pending | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const point = (node: Node, offset: number) => {
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const piece = node.parentElement?.closest<HTMLElement>("[data-o]");
    const paragraph = piece?.closest<HTMLElement>("[data-paragraph]");
    if (!piece || !paragraph || !root.contains(paragraph)) return null;
    return { paragraph, at: Number(piece.dataset.o) + offset };
  };
  const a = point(range.startContainer, range.startOffset);
  const b = point(range.endContainer, range.endOffset);
  if (!a || !b || a.paragraph !== b.paragraph) return null;
  const section = Number(a.paragraph.dataset.section);
  const paragraph = Number(a.paragraph.dataset.paragraph);
  const text = content.sections[section]?.paragraphs[paragraph]?.text ?? "";
  let start = Math.min(a.at, b.at);
  let end = Math.max(a.at, b.at);
  while (start < end && /\s/.test(text[start] ?? "")) start++;
  while (end > start && /\s/.test(text[end - 1] ?? "")) end--;
  if (end <= start || end - start > 500) return null;
  return { section, paragraph, start, end, quote: text.slice(start, end) };
}

// The student's own marks in this lesson: placed on the current version (or kept aside as notes
// from an earlier version), plus what is selected now and which mark is being changed.
export function useAnnotations(root: RefObject<HTMLElement | null>, opts: { topicId: string; lessonId: string; content: LessonContent; initial: Annotation[] }) {
  const { topicId, lessonId, content } = opts;
  const [all, setAll] = useState<Annotation[]>(opts.initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const placed = useMemo(() => all.map((a) => placeAnnotation(a, content)).filter((a): a is Placed => a !== null), [all, content]);
  const earlier = useMemo(() => all.filter((a) => !placed.some((p) => p.id === a.id)), [all, placed]);

  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const element = root.current;
        if (!element) return;
        const found = readSelection(element, content);
        if (found) {
          setPending(found);
          setEditing(null);
        }
      }, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [root, content]);

  async function add(style: AnnotationStyle, note = "") {
    if (!pending) return;
    setError(undefined);
    const result = await addAnnotation({ topicId, lessonId, ...pending, style, note });
    if (!result.ok) return setError(result.message);
    setAll((list) => [...list, result.annotation]);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  async function change(id: string, style: AnnotationStyle, note: string) {
    setError(undefined);
    const result = await changeAnnotation({ id, style, note });
    if (!result.ok) return setError(result.message);
    setAll((list) => list.map((a) => (a.id === id ? { ...a, style, note: note || null } : a)));
    setEditing(null);
  }

  async function remove(id: string) {
    setError(undefined);
    const result = await removeAnnotation({ id });
    if (!result.ok) return setError(result.message);
    setAll((list) => list.filter((a) => a.id !== id));
    setEditing(null);
  }

  const close = () => {
    setPending(null);
    setEditing(null);
    setError(undefined);
  };

  return { placed, earlier, pending, editing: all.find((a) => a.id === editing) ?? null, edit: setEditing, add, change, remove, close, error };
}
