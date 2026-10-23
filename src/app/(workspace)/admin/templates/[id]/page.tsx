import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftingStatusBar } from "@/components/draft/DraftingStatusBar";
import { TemplateSpecView } from "@/components/draft/TemplateSpecView";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { getStaffRole } from "@/server/auth/roles";
import { getTemplate } from "@/server/db/drafting";

export const metadata: Metadata = { title: "Template · Lawdeck" };

export default function TemplatePage({
  params,
}: PageProps<"/admin/templates/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/admin/templates" className="text-sm">
        All templates
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the template" />}>
        <Template params={params} />
      </Suspense>
    </div>
  );
}

async function Template({
  params,
}: Pick<PageProps<"/admin/templates/[id]">, "params">) {
  const role = await getStaffRole();
  if (!role) notFound();
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <>
      <h1 className="break-words font-serif text-3xl font-normal text-greeting">
        {template.title}
      </h1>
      <p className="text-muted break-words">
        {template.courseName} · version {template.version}
        {template.forumNames.length > 0
          ? ` · for ${template.forumNames.join(", ")}`
          : ""}
        {template.reviewedAt
          ? ` · status last changed ${formatWat(template.reviewedAt)}`
          : ""}
      </p>
      <p className="break-words">
        Follows:{" "}
        {template.ruleSource ?? (
          <span className="text-warning">no rule source yet</span>
        )}
      </p>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <DraftingStatusBar
          kind="template"
          id={template.id}
          name={template.title}
          status={template.status}
          isAdmin={role === "admin"}
          afterDelete="/admin/templates"
        />
      </div>
      {template.spec ? (
        <TemplateSpecView spec={template.spec} />
      ) : (
        <div
          role="alert"
          className="rounded-2xl border border-warning p-4 text-warning"
        >
          <p>
            This template has problems and cannot be approved. Fix its file and
            load it again:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {template.issues.map((issue) => (
              <li key={issue} className="break-words">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
