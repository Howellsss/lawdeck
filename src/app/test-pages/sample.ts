import "server-only";
import { DEFAULT_PROFILE, forumFileSchema, templateFileSchema, type DocumentContent, type TemplateField } from "@/schemas/drafting";
import { buildDocument, type DocModel } from "@/server/documents/render";
import { FORUM_FILES, TEMPLATE_FILES } from "@/templates";

// For the export test only (step 5h): a template drawn with made-up facts and filler text long
// enough to run over several pages. Reached only when LAWDECK_TEST_PAGES=1, which the live site
// never sets. No real people and no legal wording beyond the template's own.

export function testPagesEnabled(): boolean {
  return process.env.LAWDECK_TEST_PAGES === "1";
}

const FILLER = "The wombat met the quokka beside the numbat's gate and they agreed on the matters set out in this paragraph.";

export function sampleModel(templateSlug: string, forumSlug: string | null): DocModel | null {
  const template = TEMPLATE_FILES.map((f) => templateFileSchema.safeParse(f)).find((r) => r.success && r.data.slug === templateSlug);
  if (!template?.success) return null;
  const t = template.data;
  if (forumSlug && !t.forums.includes(forumSlug)) return null;
  const forum = FORUM_FILES.map((f) => forumFileSchema.parse(f)).find((f) => f.slug === forumSlug);
  const narrative: Record<string, string> = {};
  for (const part of t.spec.parts) {
    if (part.kind !== "narrative") continue;
    const sentences = Math.max(1, Math.floor((part.maxWords ?? 200) / 22));
    narrative[part.id] = Array.from({ length: Math.min(sentences, 12) }, (_, i) => `${i + 1}. ${FILLER}`).join("\n");
  }
  const content: DocumentContent = { fields: Object.fromEntries(t.spec.fields.map((f) => [f.id, sampleFact(f)])), narrative, edits: {} };
  return buildDocument({ title: t.title, spec: t.spec, profile: forum?.profile ?? DEFAULT_PROFILE, forumSlug: forumSlug, content });
}

function sampleFact(field: TemplateField): string | string[] {
  if (field.type === "date") return "2026-10-23";
  const one = (n: number) => `Quokka ${field.label} ${n}`;
  return field.repeatable ? [one(1), one(2), one(3)] : one(1);
}
