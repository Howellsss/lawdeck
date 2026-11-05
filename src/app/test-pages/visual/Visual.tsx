"use client";

import { useState, type ReactNode } from "react";
import { RightPanelContext } from "@/components/shell/panelContext";
import { VisualRevision } from "@/components/study/VisualRevision";
import type { LessonContent } from "@/schemas/lesson";

const text = "A wombat summons suits questions of construction. The court will not decide disputed facts on affidavits alone. See Wombat v Quokka.";
const content: LessonContent = {
  sections: [
    {
      heading: "When to use a wombat summons",
      paragraphs: [
        {
          text,
          sources: [1],
          marks: [
            { start: 2, end: 16, type: "definition" },
            { start: 116, end: 131, type: "case", authority: "wombat-v-quokka" },
          ],
        },
      ],
    },
  ],
  sources: [{ label: 1, passageId: "00000000-0000-4000-8000-000000000801", title: "Made-up notes", heading: null, pages: "p. 1" }],
};

// The real Visual Revision component with a stand-in side panel (the app shell provides the real one).
export function Visual() {
  const [panel, setPanel] = useState<{ title: string; body: ReactNode } | null>(null);
  return (
    <RightPanelContext.Provider value={{ open: setPanel, close: () => setPanel(null) }}>
      <VisualRevision
        topicId="00000000-0000-4000-8000-000000000802"
        content={content}
        annotations={[
          { id: "00000000-0000-4000-8000-000000000803", lessonId: null, section: 0, paragraph: 0, start: 54, end: 59, quote: "court", style: "underline", note: "Made-up note" },
        ]}
        authorities={[
          {
            key: "wombat-v-quokka",
            kind: "case",
            name: "Wombat v Quokka",
            citation: null,
            court: null,
            facts: null,
            factsFromLibrary: false,
            issue: null,
            decision: null,
            principle: "A made-up principle.",
            sources: [1],
          },
        ]}
      />
      {panel && (
        <aside aria-label={panel.title} className="rounded-2xl border border-line p-4">
          {panel.body}
        </aside>
      )}
    </RightPanelContext.Provider>
  );
}
