import {
  DEFAULT_PROFILE,
  documentContentSchema,
  forumProfileSchema,
  templateSpecSchema,
  type DocumentContent,
  type ForumProfile,
  type TemplateSpec,
} from "@/schemas/drafting";
import { buildDocument, type DocModel } from "./render";

export type DocumentLayout = { title: string; spec: TemplateSpec; profile: ForumProfile; forumSlug: string | null };

type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";

// Turns a stored document (its template, court and saved text) into the model that draws its
// pages. Unreviewed wording is never shown (CLAUDE.md): a template or court sent back for review,
// or removed, is not drawn until it is approved again; the student's facts and text stay saved.
// Used for the student's own documents and for documents shared with them (step 6d).
export function drawDocument(input: {
  title: string;
  // False when the document has no court chosen.
  hasForum: boolean;
  template: { spec: unknown; status: ReviewStatus } | null;
  forum: { slug: string; profile: unknown; status: ReviewStatus } | null;
  content: unknown;
}): { layout: DocumentLayout | null; model: DocModel | null; spec: TemplateSpec | null; content: DocumentContent | null } {
  const content = documentContentSchema.safeParse(input.content ?? {});
  const spec = input.template?.status === "approved" ? templateSpecSchema.safeParse(input.template.spec) : null;
  const forumUsable = !input.hasForum || input.forum?.status === "approved";
  const profile = input.forum && forumUsable ? forumProfileSchema.safeParse(input.forum.profile) : null;
  const layout: DocumentLayout | null =
    spec?.success && forumUsable && (!input.hasForum || profile?.success)
      ? {
          title: input.title,
          spec: spec.data,
          profile: profile?.success ? profile.data : DEFAULT_PROFILE,
          forumSlug: input.forum?.slug ?? null,
        }
      : null;
  const model = layout && content.success ? buildDocument({ ...layout, content: content.data }) : null;
  return {
    // What draws this document (any of its versions); null while it is being re-checked.
    layout: model ? layout : null,
    model,
    spec: model && spec?.success ? spec.data : null,
    content: content.success ? content.data : null,
  };
}
