import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GenerateLessonButton } from "@/components/lessons/GenerateLessonButton";
import { HighlightFrame } from "@/components/lessons/HighlightFrame";
import { LessonBody } from "@/components/lessons/LessonBody";
import { ExtrasReview } from "@/components/lessons/ExtrasReview";
import { LessonDecision } from "@/components/lessons/LessonDecision";
import { RemovePartButton } from "@/components/lessons/RemovePartButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { topicIdSchema } from "@/schemas/lesson";
import { getLessonForReview, type Authority, type Checkpoint } from "@/server/db/lessons";

export const metadata: Metadata = { title: "Review a lesson · Lawdeck" };

const KIND_LABELS: Record<Checkpoint["kind"], string> = {
  mcq: "Multiple choice",
  short: "Short answer",
  open: "Open recall",
  authority: "Which authority",
  statute: "Which provision",
  principle: "Principle",
  sequence: "Order of steps",
};

// One topic's lesson for a reviewer: the text with its highlights, every authority card and every
// recall question with its answer, the passages it rests on, and the decision.
export default function LessonReviewPage({ params }: PageProps<"/admin/lessons/[topicId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the lesson" />}>
        <Review params={params} />
      </Suspense>
    </div>
  );
}

async function Review({ params }: { params: Promise<{ topicId: string }> }) {
  const id = topicIdSchema.safeParse((await params).topicId);
  if (!id.success) notFound();
  const data = await getLessonForReview(id.data);
  if (!data) notFound();
  const { lesson } = data;
  const reading = data.checkpoints.filter((c) => c.placement === "reading");
  const test = data.checkpoints.filter((c) => c.placement === "test");

  return (
    <>
      <Link href="/admin/lessons" className="text-sm text-muted">
        ← All lessons
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">{data.course.name}</p>
        <h1 className="font-serif text-3xl font-normal text-greeting">{data.topic.name}</h1>
        {lesson && (
          <p className={`text-sm ${lesson.status === "approved" ? "text-success" : "text-muted"}`}>
            {REVIEW_STATUS_LABELS[lesson.status]}
            {lesson.bulkApproved ? " with its course (not yet read in full; students see a note)" : ""} · version {lesson.version} · {formatWat(lesson.updatedAt)}
            {lesson.model ? ` · written by ${lesson.model}` : ""}
          </p>
        )}
      </div>

      <GenerateLessonButton topicId={data.topic.id} hasLesson={Boolean(lesson)} />

      {!lesson ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No lesson yet. Lawdeck writes it from the approved library for this course; you then check and approve it.
        </p>
      ) : !lesson.content ? (
        <p role="alert" className="rounded-2xl border border-warning px-4 py-3 text-sm text-warning">
          This lesson&rsquo;s text could not be read. Rewrite it from the library.
        </p>
      ) : (
        <>
          <LessonDecision lessonId={lesson.id} status={lesson.status} note={lesson.reviewNote} bulkApproved={lesson.bulkApproved} />
          <HighlightFrame>
            <LessonBody
              content={lesson.content}
              after={(index) => {
                const here = reading.filter((c) => c.after_section === index);
                return here.length ? <CheckpointList items={here} title="Recall questions here" /> : null;
              }}
            />
          </HighlightFrame>
          <CheckpointList items={test} title={`End-of-topic test (${test.length} questions)`} />
          <Authorities items={data.authorities} />
          <section aria-labelledby="sources" className="flex flex-col gap-2">
            <h2 id="sources" className="text-lg font-medium">
              Library passages used ({lesson.content.sources.length})
            </h2>
            <ol className="flex flex-col gap-1 text-sm text-muted">
              {lesson.content.sources.map((source) => (
                <li key={source.label}>
                  S{source.label} · {source.title}
                  {source.heading ? ` · ${source.heading}` : ""}
                  {source.pages ? ` · ${source.pages}` : ""}
                </li>
              ))}
            </ol>
          </section>
          <ExtrasReview topicId={data.topic.id} extras={data.extras} authorityNames={new Map(data.authorities.map((a) => [a.key, a.name]))} />
        </>
      )}
    </>
  );
}

function CheckpointList({ items, title }: { items: Checkpoint[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-[15px] font-medium">{title}</h3>
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-xs text-muted">
                {KIND_LABELS[item.kind]} · tests: {item.key_point}
              </span>
              <span className="font-medium">{item.prompt}</span>
              {Array.isArray(item.choices) && (
                <ol className="list-[upper-alpha] pl-5">
                  {(item.choices as string[]).map((choice, i) => (
                    <li key={i} className={i === item.correct_choice ? "font-medium text-success" : ""}>
                      {choice}
                    </li>
                  ))}
                </ol>
              )}
              <span>
                <span className="text-muted">Answer: </span>
                {item.answer}
              </span>
              {item.explanation && <span className="text-muted">{item.explanation}</span>}
            </div>
            <RemovePartButton kind="checkpoint" id={item.id} label={`question: ${item.key_point}`} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Authorities({ items }: { items: Authority[] }) {
  return (
    <section aria-labelledby="authorities" className="flex flex-col gap-2">
      <h2 id="authorities" className="text-lg font-medium">
        Authority cards ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">This lesson names no case or statute.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">
                  {item.kind === "case" ? <i>{item.name}</i> : item.name}
                  {item.citation ? ` ${item.citation}` : ""}
                </span>
                {item.court && <span className="text-muted">{item.court}</span>}
                <span>
                  <span className="text-muted">Principle: </span>
                  {item.principle}
                </span>
                {item.kind === "case" &&
                  (item.facts_from_library && item.facts ? (
                    <span>
                      <span className="text-muted">Facts: </span>
                      {item.facts}
                    </span>
                  ) : (
                    <span className="text-warning">Facts not in the library: verification required.</span>
                  ))}
                {item.issue && (
                  <span>
                    <span className="text-muted">Issue: </span>
                    {item.issue}
                  </span>
                )}
                {item.decision && (
                  <span>
                    <span className="text-muted">Decision: </span>
                    {item.decision}
                  </span>
                )}
              </div>
              <RemovePartButton kind="authority" id={item.id} label={`authority: ${item.name}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
