import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForumList } from "@/components/draft/ForumList";
import { LoadFilesButton } from "@/components/draft/LoadFilesButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { DRAFTING_STATUS_LABELS } from "@/schemas/drafting";
import { getStaffRole } from "@/server/auth/roles";
import { listDrafting } from "@/server/db/drafting";

export const metadata: Metadata = { title: "Templates · Lawdeck" };

// Document templates and court formats (step 5b): reviewers and admins only; everyone else gets
// "page not found". Students see only what is approved here.
export default function TemplatesPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the templates" />}>
        <Templates />
      </Suspense>
    </div>
  );
}

async function Templates() {
  const [items, role] = await Promise.all([listDrafting(), getStaffRole()]);
  if (!items) notFound();
  return (
    <>
      <h1 className="font-serif text-3xl font-normal text-greeting">
        Templates
      </h1>
      <p className="text-muted">
        Document templates and court formats come from files checked by Lawdeck.
        Loading adds new and changed files as drafts. Students only ever see
        what you approve; changing an approved file sends it back to draft.
      </p>
      <LoadFilesButton />

      <section aria-labelledby="documents" className="flex flex-col gap-3">
        <h2 id="documents" className="font-serif text-2xl font-normal">
          Document templates
        </h2>
        {items.templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
            No document templates yet. The first ones are drafted from the
            library’s prescribed forms for the legal reviewer to check.
          </p>
        ) : (
          <ul
            aria-label="Document templates"
            className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface"
          >
            {items.templates.map((template) => (
              <li key={template.id} className="flex flex-col gap-1 px-4 py-3">
                <Link
                  href={`/admin/templates/${template.id}`}
                  className="break-words font-medium"
                >
                  {template.title}
                </Link>
                <span className="text-sm text-muted">
                  {template.courseName} · version {template.version} ·{" "}
                  <span
                    className={
                      template.status === "approved" ? "text-success" : ""
                    }
                  >
                    {DRAFTING_STATUS_LABELS[template.status]}
                  </span>{" "}
                  · updated {formatWat(template.updatedAt)}
                </span>
                {template.forumNames.length > 0 && (
                  <span className="text-sm text-muted break-words">
                    For: {template.forumNames.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="forums" className="flex flex-col gap-3">
        <h2 id="forums" className="font-serif text-2xl font-normal">
          Courts and registries
        </h2>
        <p className="text-muted">
          Confirm each formatting profile against the court’s rules or practice
          directions before approving.
        </p>
        <ForumList forums={items.forums} isAdmin={role === "admin"} />
      </section>
    </>
  );
}
