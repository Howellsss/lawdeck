"use client";

import { useEffect } from "react";

// Opening a lesson at a section (from Visual Revision Mode: /study/<topic>#lesson-section-3):
// reveal the lesson up to that section, then scroll to it.
export function useJumpToSection(sections: number, reveal: (index: number) => void) {
  useEffect(() => {
    const match = /^#lesson-section-(\d+)$/.exec(window.location.hash);
    if (!match) return;
    const index = Math.min(Number(match[1]), sections - 1);
    reveal(index);
    const timer = window.setTimeout(() => document.getElementById(`lesson-section-${index}`)?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(timer);
  }, [sections, reveal]);
}
