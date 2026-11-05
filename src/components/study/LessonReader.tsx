"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HighlightFrame } from "@/components/lessons/HighlightFrame";
import { LessonBody } from "@/components/lessons/LessonBody";
import { useRightPanel } from "@/components/shell/panelContext";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { StudyLesson } from "@/server/db/study";
import { completeStudySession, openStudySession, saveStudyProgress } from "@/server/study/actions";
import { AuthorityCard } from "./AuthorityCard";
import { RecallCard } from "./RecallCard";
import { SectionExtras } from "./SectionExtras";
import { TopicTest } from "./TopicTest";

const RECALL_KEY = "lawdeck-recall";
const SAVE_EVERY_MS = 60_000;

function recallStored(): boolean | null {
  try {
    const value = localStorage.getItem(RECALL_KEY);
    return value === "off" ? false : value === "on" ? true : null;
  } catch {
    return null;
  }
}

// The student's lesson (docs/specs/remembrance.md, Phase 1b). With recall on (the default), the
// lesson opens one section at a time; after a section that teaches something worth remembering,
// its questions appear and the next section opens once they are answered or skipped. With recall
// off, the whole lesson shows. Reading progress and time are saved, so an interrupted session
// carries on where it stopped; the topic test comes at the end.
export function LessonReader({ data }: { data: StudyLesson & { lesson: NonNullable<StudyLesson["lesson"]> } }) {
  const panel = useRightPanel();
  const sections = data.lesson.content.sections.length;
  const reading = data.checkpoints.filter((c) => c.placement === "reading");
  const test = data.checkpoints.filter((c) => c.placement === "test");
  const storedRecall = useSyncExternalStore(() => () => {}, recallStored, () => null);
  const [recallChoice, setRecallChoice] = useState<boolean | null>(null);
  const recall = recallChoice ?? storedRecall ?? true;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [upTo, setUpTo] = useState(0);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const activeSince = useRef(0);
  const upToRef = useRef(0);
  useEffect(() => {
    upToRef.current = upTo;
  }, [upTo]);

  // Start (or continue today's) session once.
  useEffect(() => {
    let live = true;
    void openStudySession({ topicId: data.topic.id }).then((opened) => {
      if (!live) return;
      if (!opened.ok) return setNotice(opened.message);
      setSessionId(opened.sessionId);
      setUpTo((current) => Math.max(current, Math.min(opened.sectionsRead, sections - 1)));
    });
    return () => {
      live = false;
    };
  }, [data.topic.id, sections]);

  // Save progress and active time while the page is open and visible.
  useEffect(() => {
    if (!sessionId) return;
    activeSince.current = Date.now();
    const save = () => {
      const seconds = document.visibilityState === "visible" ? Math.min(120, Math.round((Date.now() - activeSince.current) / 1000)) : 0;
      activeSince.current = Date.now();
      void saveStudyProgress({ sessionId, sectionsRead: upToRef.current + 1, addSeconds: seconds });
    };
    const timer = window.setInterval(save, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [sessionId]);

  function chooseRecall(on: boolean) {
    setRecallChoice(on);
    try {
      localStorage.setItem(RECALL_KEY, on ? "on" : "off");
    } catch {
      // Private browsing: the choice lasts for this page only.
    }
  }

  const openAuthority = (key: string) => {
    const authority = data.authorities.find((a) => a.key === key);
    if (authority) panel.open({ title: authority.kind === "case" ? "Case" : "Statute", body: <AuthorityCard authority={authority} sources={data.lesson.content.sources} /> });
  };

  const authorityNames = new Map(data.authorities.map((a) => [a.key, a.name]));
  const shownUpTo = recall ? upTo : sections - 1;
  const pendingHere = (index: number) => reading.filter((c) => c.afterSection === index && !answered.has(c.id));
  const finishedReading = shownUpTo >= sections - 1 && (!recall || pendingHere(sections - 1).length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          Section {Math.min(shownUpTo + 1, sections)} of {sections}
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={recall} onChange={(event) => chooseRecall(event.target.checked)} />
          Questions while reading
        </label>
      </div>
      {notice && (
        <p role="alert" className="text-sm text-warning">
          {notice}
        </p>
      )}
      <HighlightFrame>
        <LessonBody
          content={data.lesson.content}
          upTo={shownUpTo}
          onAuthority={openAuthority}
          after={(index) => {
            const extras = <SectionExtras index={index} aids={data.aids} stories={data.stories} authorityNames={authorityNames} />;
            if (!recall) return extras;
            const here = reading.filter((c) => c.afterSection === index);
            const waiting = pendingHere(index);
            return (
              <div className="flex flex-col gap-3">
                {extras}
                {here.map((checkpoint) => (
                  <RecallCard
                    key={checkpoint.id}
                    checkpoint={checkpoint}
                    sessionId={sessionId}
                    context="reading"
                    onDone={() => setAnswered((set) => new Set(set).add(checkpoint.id))}
                  />
                ))}
                {index === upTo && index < sections - 1 && (
                  <button
                    type="button"
                    disabled={waiting.length > 0}
                    onClick={() => setUpTo(index + 1)}
                    className={`${compactPrimaryButton} self-start`}
                  >
                    {waiting.length > 0 ? "Answer or skip the question to continue" : "Continue reading"}
                  </button>
                )}
              </div>
            );
          }}
        />
      </HighlightFrame>
      {finishedReading && !testing && (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4">
          <p className="font-medium">You&rsquo;ve reached the end of the lesson.</p>
          <p className="text-sm text-muted">
            Test yourself on the whole topic: {test.length} question{test.length === 1 ? "" : "s"}, answered from memory.
          </p>
          <button type="button" onClick={() => setTesting(true)} className={compactPrimaryButton} disabled={test.length === 0}>
            Take the topic test
          </button>
        </div>
      )}
      {testing && (
        <TopicTest
          questions={test}
          sessionId={sessionId}
          onFinished={() => {
            if (sessionId) void completeStudySession({ sessionId });
          }}
        />
      )}
    </div>
  );
}
