import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExportButtons } from "@/components/exports/ExportButtons";
import { DeleteSetButton } from "@/components/practice/DeleteSetButton";
import { MarkedItem } from "@/components/marking/MarkedItem";
import { FlashcardDeck } from "@/components/practice/FlashcardDeck";
import { McqItem } from "@/components/practice/McqItem";
import { ScenarioItem } from "@/components/practice/ScenarioItem";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { getPracticeSet } from "@/server/db/practice";

export const metadata: Metadata = { title: "Practice set · Lawdeck" };

// One practice set: multiple-choice questions to answer, scenarios with model answers, or flashcards.
export default function PracticeSetPage({
  params,
  searchParams,
}: PageProps<"/practice/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/practice" className="text-sm">
        All practice
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the questions" />}>
        <SetView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SetView({
  params,
  searchParams,
}: Pick<PageProps<"/practice/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const justMarked = (await searchParams).marked === "1";
  const result = await getPracticeSet(id);
  if (result.status === "signed-out")
    return (
      <SignInPrompt
        level={1}
        what="practice sets"
        returnTo={`/practice/${id}`}
      />
    );
  if (!result.data) notFound();
  const set = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">
          {set.title}
        </h1>
        <p className="text-sm text-muted">
          Made {formatWat(set.createdAt)} from approved course material.
        </p>
      </div>
      {set.kind === "flashcards" ? (
        <FlashcardDeck
          cards={set.items.map((item) => ({
            id: item.id,
            front: item.question,
            reveal: item.reveal,
            known: item.known,
          }))}
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {set.items.map((item, index) =>
            item.marked ? (
              <MarkedItem
                key={item.id}
                question={item.question}
                answerText={item.marked.answerText}
                feedback={item.marked.feedback}
                openNow={justMarked}
              />
            ) : item.choices ? (
              <McqItem
                key={item.id}
                number={index + 1}
                id={item.id}
                question={item.question}
                choices={item.choices}
                chosen={item.chosen}
                reveal={item.reveal}
              />
            ) : (
              <ScenarioItem
                key={item.id}
                number={index + 1}
                id={item.id}
                question={item.question}
              />
            ),
          )}
        </ol>
      )}
      <ExportButtons kind="practice" id={set.id} notKnownOption={set.kind === "flashcards"} />
      <DeleteSetButton id={set.id} />
    </>
  );
}
