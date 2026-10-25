import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pager } from "@/components/library/Pager";
import { PassageCard } from "@/components/library/PassageCard";
import { ReadingSummary } from "@/components/library/ReadingSummary";
import { RecheckNotice } from "@/components/library/RecheckNotice";
import { ItemUsage } from "@/components/library/ItemUsage";
import { ReviewPanel } from "@/components/library/ReviewPanel";
import { SourcePresentationForm } from "@/components/library/SourcePresentationForm";
import { SearchSummary } from "@/components/library/SearchSummary";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { KB_ITEM_TYPES, REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { approvalBlockers, todayInLagos } from "@/lib/reviewRules";
import { libraryItemIdSchema } from "@/schemas/library";
import { reviewPageSchema } from "@/schemas/libraryReview";
import { getStaffRole } from "@/server/auth/roles";
import { getRecheckReasons } from "@/server/db/lawChanges";
import { getLibraryItem, getReviewPassages, PASSAGES_PER_PAGE } from "@/server/db/library";
import { getItemUsage, getSourcePresentation } from "@/server/db/sourcePresentation";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";

export const metadata: Metadata = { title: "Review · Library · Lawdeck" };
// Saving a correction re-indexes the passage, which calls Voyage AI.
export const maxDuration = 60;

export default function ReviewItemPage(props: PageProps<"/admin/library/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/admin/library" className="text-sm">
        All library items
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the item" />}>
        <ReviewItem {...props} />
      </Suspense>
    </div>
  );
}

// Reviewers and admins only; everyone else gets "page not found".
async function ReviewItem({ params, searchParams }: PageProps<"/admin/library/[id]">) {
  const role = await getStaffRole();
  if (!role) notFound();
  const { id } = await params;
  if (!libraryItemIdSchema.safeParse(id).success) notFound();
  const item = await getLibraryItem(id);
  if (!item) notFound();

  const query = await searchParams;
  const page = reviewPageSchema.parse(query.page);
  const [{ passages, total }, recheck, presentation, usage] = await Promise.all([
    getReviewPassages(id, page, EMBEDDING_MODEL),
    getRecheckReasons([id]),
    getSourcePresentation(id),
    getItemUsage(id),
  ]);
  const pages = Math.max(1, Math.ceil(total / PASSAGES_PER_PAGE));
  const blockers = approvalBlockers(
    {
      readingStatus: item.reading.status,
      passages: item.reading.passages,
      indexedPassages: item.search.indexed,
      indexModel: item.search.model,
      indexedAt: item.search.indexedAt,
    },
    EMBEDDING_MODEL,
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{item.title}</h1>
        <p className="text-sm text-muted">
          {[item.courseName, KB_ITEM_TYPES[item.type], item.year, item.fileName].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">
          {REVIEW_STATUS_LABELS[item.reviewStatus]}
          {item.review.reviewedAt && <span className="text-muted"> · Last decision {formatWat(item.review.reviewedAt)}</span>}
        </p>
        <p className="text-sm">
          <ReadingSummary reading={item.reading} />
        </p>
        <p className="text-sm">
          <SearchSummary item={item} currentModel={EMBEDDING_MODEL} />
        </p>
      </div>

      <RecheckNotice reasons={recheck.get(id) ?? []} />

      <ReviewPanel
        id={item.id}
        status={item.reviewStatus}
        lawCurrentAsOf={item.review.lawCurrentAsOf}
        note={item.review.note}
        blockers={blockers}
        today={todayInLagos()}
      />

      <section aria-labelledby="students-see" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="students-see" className="text-lg font-medium">
          What students see
        </h2>
        {presentation ? (
          <>
            <p className="text-sm text-muted">
              Students never see a lecturer&apos;s name, the file name, the Drive link or the page numbers of private notes.
              {presentation.driveSource && <span className="break-all"> Original source (staff only): {presentation.driveSource}</span>}
            </p>
            <SourcePresentationForm id={item.id} initial={presentation} />
          </>
        ) : (
          <p role="alert" className="text-sm text-warning">
            Student labels need database update 37 first. Paste it into Supabase, then reload this page.
          </p>
        )}
        {usage && <ItemUsage usage={usage} />}
      </section>

      <section aria-labelledby="passages" className="flex flex-col gap-3">
        <h2 id="passages" className="text-lg font-medium">
          Passages ({total})
        </h2>
        {total === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
            No passages yet. An admin reads the file first.
          </p>
        ) : (
          <>
            <Pager page={page} pages={pages} hrefFor={(n) => `/admin/library/${id}?page=${n}`} />
            <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
              {passages.map((passage) => (
                <PassageCard key={`${passage.id}-${passage.text.length}`} passage={passage} />
              ))}
            </ol>
            <Pager page={page} pages={pages} hrefFor={(n) => `/admin/library/${id}?page=${n}`} />
          </>
        )}
      </section>
    </>
  );
}
