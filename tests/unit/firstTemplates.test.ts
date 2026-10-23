import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, forumFileSchema, templateFileSchema, type TemplateFile } from "@/schemas/drafting";
import { checkDocument } from "@/server/documents/checks";
import { documentToDocx } from "@/server/documents/docx";
import { buildDocument, plainText } from "@/server/documents/render";
import { FORUM_FILES, TEMPLATE_FILES } from "@/templates";

// The first templates (step 5g) as students would get them: every court they are for, with no
// facts given (all placeholders) and with every fact given.
const forums = FORUM_FILES.map((file) => forumFileSchema.parse(file));
const templates = TEMPLATE_FILES.map((file) => {
  const parsed = templateFileSchema.safeParse(file);
  if (!parsed.success) throw new Error(`${(file as { slug?: string }).slug}: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
});

function draw(template: TemplateFile, forumSlug: string | null, fields: Record<string, string | string[]> = {}) {
  const forum = forums.find((f) => f.slug === forumSlug);
  const content = { fields, narrative: {}, edits: {} };
  const model = buildDocument({ title: template.title, spec: template.spec, profile: forum?.profile ?? DEFAULT_PROFILE, forumSlug, content });
  return { model, content };
}

describe("the first templates", () => {
  it("has the documents of steps 5g and 5f", () => {
    expect(templates.map((t) => t.slug).sort()).toEqual(
      [
        "deed-of-assignment",
        "list-of-documents",
        "list-of-witnesses",
        "motion-on-notice-with-affidavit",
        "pre-action-protocol-form-01",
        "statement-of-claim",
        "tenancy-agreement",
        "witness-statement-on-oath",
        "writ-of-summons",
      ].sort(),
    );
  });

  for (const template of templates) {
    describe(template.title, () => {
      it("names only courts and registries that exist, and related documents that exist", () => {
        for (const slug of template.forums) expect(forums.map((f) => f.slug)).toContain(slug);
        for (const slug of template.spec.related) expect(templates.map((t) => t.slug)).toContain(slug);
      });

      it("uses every question it asks", () => {
        const text = template.spec.parts.map((p) => `${p.text ?? ""} ${p.instruction ?? ""}`).join(" ");
        const narrative = template.spec.parts.some((p) => p.kind === "narrative");
        for (const field of template.spec.fields) {
          // Facts used only by the AI-written parts reach them through the facts list.
          if (!narrative) expect(text, field.id).toContain(`{{${field.id}}}`);
        }
      });

      for (const forumSlug of template.forums.length ? template.forums : [null]) {
        it(`draws for ${forumSlug ?? "no court"}, with one court heading and placeholders for every missing fact`, () => {
          const { model, content } = draw(template, forumSlug);
          const text = plainText(model);
          const headings = text.match(/^IN THE HIGH COURT OF/gm) ?? [];
          const affidavit = template.spec.parts.some((p) => p.id === "affidavitIntro");
          if (template.course === "civil-litigation") expect(headings).toHaveLength(affidavit ? 2 : 1);
          if (forumSlug === "lagos-high-court") expect(text).not.toContain("FEDERAL CAPITAL TERRITORY");
          if (forumSlug === "fct-high-court") expect(text).not.toContain("LAGOS STATE\nIN THE");
          expect(text).not.toMatch(/\{\{/);
          expect(checkDocument(template.spec, content, model).some((i) => i.kind === "missing_fact")).toBe(true);
        });
      }

      it("fills every fact when given, leaving no placeholder for them", async () => {
        const fields = Object.fromEntries(
          template.spec.fields.map((f) => [f.id, f.type === "date" ? "2026-10-23" : f.repeatable ? ["Wombat One", "Wombat Two"] : `Quokka ${f.id}`]),
        );
        const { model } = draw(template, template.forums[0] ?? null, fields);
        const placeholders = model.blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.runs)).filter((r) => r.placeholder && r.field);
        expect(placeholders).toEqual([]);
        expect((await documentToDocx(model)).byteLength).toBeGreaterThan(5000);
      });
    });
  }
});

describe("page breaks (step 5h)", () => {
  it("starts the motion's affidavit on a new page, in the model and in Word", async () => {
    const motion = templates.find((t) => t.slug === "motion-on-notice-with-affidavit");
    if (!motion) throw new Error("motion template missing");
    for (const forum of motion.forums) {
      const { model } = draw(motion, forum);
      const breaks = model.blocks.filter((b) => b.pageBreakBefore).map((b) => b.partId);
      expect(breaks).toEqual([forum === "lagos-high-court" ? "courtLagosAffidavit" : "courtFctAffidavit"]);
    }
    const { model } = draw(motion, "lagos-high-court");
    const JSZip = (await import("jszip")).default;
    const xml = await (await JSZip.loadAsync(await documentToDocx(model))).file("word/document.xml")!.async("string");
    expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
    expect(xml).toContain("<w:keepLines/>");
  });
});
