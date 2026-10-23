import { z } from "zod";

// Drafting data files (Phase 5, step 5b; System Design §7; rule H-03). Each court or registry has
// a formatting profile, and each document type has a template spec. Both live as data files in
// src/templates, are checked here before a reviewer can approve them, and are rendered by one
// engine (step 5c). No legal wording lives in code: it lives in the files, reviewed.

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: "Use lower-case words joined by hyphens.",
  })
  .max(80);
const id = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, {
    error: "Use a short camelCase name, e.g. claimantName.",
  })
  .max(60);
const line = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.iso.date({ error: "Use a date like 2026-10-23." });

// ---------------------------------------------------------------------------
// Formatting profiles (PRD 7.3). Default where no rule applies: A4, Times New Roman 12 pt,
// 1.5 line spacing, 1-inch (25.4 mm) margins.
export const forumProfileSchema = z.strictObject({
  paper: z.enum(["A4", "Letter", "Legal"]),
  font: line(60),
  fontSizePt: z.number().min(9).max(16),
  lineSpacing: z.union([
    z.literal(1),
    z.literal(1.15),
    z.literal(1.5),
    z.literal(2),
  ]),
  marginsMm: z.strictObject({
    top: z.number().min(10).max(60),
    right: z.number().min(10).max(60),
    bottom: z.number().min(10).max(60),
    left: z.number().min(10).max(60),
  }),
  pageNumbers: z.enum(["none", "bottom-centre", "bottom-right", "top-right"]),
  coverPage: z.boolean(),
  // Who signs at the end: counsel (legal practitioner), the party, or both.
  signatureBlock: z.enum(["counsel", "party", "both"]),
  // Where the formatting comes from (practice direction, rules), or the Lawdeck default.
  source: line(500),
});
export type ForumProfile = z.infer<typeof forumProfileSchema>;

export const DEFAULT_PROFILE: ForumProfile = {
  paper: "A4",
  font: "Times New Roman",
  fontSizePt: 12,
  lineSpacing: 1.5,
  marginsMm: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  pageNumbers: "bottom-centre",
  coverPage: false,
  signatureBlock: "counsel",
  source: "Lawdeck default (PRD 7.3): to be confirmed by a reviewer",
};

export const forumFileSchema = z.strictObject({
  slug,
  name: line(200),
  kind: z.enum(["court", "registry"]),
  state: line(60).nullable(),
  profile: forumProfileSchema,
});
export type ForumFile = z.infer<typeof forumFileSchema>;

// ---------------------------------------------------------------------------
// Template specs (PRD 7.2). Parts in order; fixed wording may use {{fieldId}} for intake facts.
export const FIELD_TYPES = [
  "text",
  "longText",
  "date",
  "money",
  "number",
  "party",
  "address",
] as const;

export const templateFieldSchema = z.strictObject({
  id,
  label: line(120),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  // Asked during intake (DR-04).
  question: line(300),
  // Shown in the document while the fact is missing, e.g. "DEFENDANT'S ADDRESS".
  placeholder: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9 ’'(),./-]*$/, {
      error: "Write the placeholder in capitals.",
    })
    .max(80),
  // More than one allowed (e.g. several defendants).
  repeatable: z.boolean().default(false),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;

export const templatePartSchema = z.strictObject({
  id,
  heading: line(200).optional(),
  // fixed: wording from the approved form; narrative: written by the AI from the intake;
  // signature: the forum's signature block.
  kind: z.enum(["fixed", "narrative", "signature"]),
  // How the part's paragraphs sit on the page.
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  text: z.string().trim().max(10000).optional(),
  // What the AI must write for a narrative part, and its length limit.
  instruction: line(1000).optional(),
  maxWords: z.number().int().min(20).max(2000).optional(),
  required: z.boolean(),
  // Only for these courts or registries (default: all the template's forums).
  forums: z.array(slug).min(1).optional(),
  // "Why is it arranged this way?" (DR-08): what the part does and the rule behind it.
  why: line(1500),
});
export type TemplatePart = z.infer<typeof templatePartSchema>;

export const templateSpecSchema = z
  .strictObject({
    parts: z.array(templatePartSchema).min(1).max(80),
    fields: z.array(templateFieldSchema).max(80),
    // Defined terms the automatic checks look for (DR-06), e.g. "the Property".
    definedTerms: z.array(line(80)).max(40).default([]),
    // Documents that usually go with this one (DR-09), by template slug.
    related: z.array(slug).max(20).default([]),
    // What changed and when (PRD 7.2).
    changeLog: z
      .array(z.strictObject({ date: isoDate, note: line(500) }))
      .min(1),
  })
  .superRefine((spec, ctx) => {
    const fieldIds = new Set(spec.fields.map((f) => f.id));
    duplicates(spec.parts.map((p) => p.id)).forEach((dup) =>
      ctx.addIssue({
        code: "custom",
        path: ["parts"],
        message: `Two parts are called "${dup}".`,
      }),
    );
    duplicates(spec.fields.map((f) => f.id)).forEach((dup) =>
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: `Two fields are called "${dup}".`,
      }),
    );
    const used = new Set<string>();
    spec.parts.forEach((part, index) => {
      const path = ["parts", index];
      if (part.kind === "fixed" && !part.text)
        ctx.addIssue({
          code: "custom",
          path,
          message: `Part "${part.id}" needs its fixed wording.`,
        });
      if (part.kind === "narrative" && (!part.instruction || !part.maxWords))
        ctx.addIssue({
          code: "custom",
          path,
          message: `Part "${part.id}" needs an instruction and a word limit for the AI.`,
        });
      for (const name of fieldTokens(part.text ?? "")) {
        used.add(name);
        if (!fieldIds.has(name))
          ctx.addIssue({
            code: "custom",
            path,
            message: `Part "${part.id}" uses {{${name}}}, which is not a field.`,
          });
      }
    });
    spec.fields.forEach((field, index) => {
      if (
        field.required &&
        !used.has(field.id) &&
        !spec.parts.some((p) => p.kind === "narrative")
      )
        ctx.addIssue({
          code: "custom",
          path: ["fields", index],
          message: `Field "${field.id}" is asked for but never used.`,
        });
    });
  });
export type TemplateSpec = z.infer<typeof templateSpecSchema>;

export const templateFileSchema = z
  .strictObject({
    slug,
    title: line(200),
    course: slug,
    forums: z.array(slug).max(40),
    ruleSource: line(500),
    spec: templateSpecSchema,
  })
  .superRefine((file, ctx) => {
    file.spec.parts.forEach((part, index) => {
      for (const forum of part.forums ?? [])
        if (!file.forums.includes(forum))
          ctx.addIssue({
            code: "custom",
            path: ["spec", "parts", index],
            message: `Part "${part.id}" names "${forum}", which this template is not for.`,
          });
    });
  });
export type TemplateFile = z.infer<typeof templateFileSchema>;

// The {{fieldId}} names used in a piece of fixed wording.
export function fieldTokens(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g)].map(
    (m) => m[1],
  );
}

function duplicates(values: string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

// One readable line for each problem, for the reviewer's screen.
export function describeIssues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, 20)
    .map((issue) =>
      issue.path.length
        ? `${issue.path.join(" › ")}: ${issue.message}`
        : issue.message,
    );
}

// Reviewer actions on forums and templates.
export const draftingIdSchema = z.uuid({
  error: "That item could not be found.",
});
export const draftingStatusSchema = z.enum([
  "approved",
  "pending",
  "withdrawn",
]);

// What the screens call each status.
export const DRAFTING_STATUS_LABELS = {
  pending: "Draft",
  approved: "Approved",
  withdrawn: "Withdrawn",
  rejected: "Rejected",
} as const;

// ---------------------------------------------------------------------------
// A student's document content (document_versions.content): the intake facts, the narrative
// parts (written by the AI or the student), and any part the student rewrote by hand.
const factValue = z.union([
  z.string().trim().max(2000),
  z.array(z.string().trim().max(2000)).max(20),
]);
export const documentContentSchema = z.strictObject({
  fields: z.record(id, factValue).default({}),
  narrative: z.record(id, z.string().max(20000)).default({}),
  edits: z.record(id, z.string().max(20000)).default({}),
});
export type DocumentContent = z.infer<typeof documentContentSchema>;

// ---------------------------------------------------------------------------
// Starting a draft (step 5d). Facts arrive as typed by the student: one answer per field, or a
// list for fields that allow several (e.g. defendants). They are checked against the template's
// own fields on the server (factsFor) before anything is saved or sent.
export const newDraftSchema = z.strictObject({
  templateId: z.uuid({ error: "That document could not be found." }),
  forumId: z.uuid({ error: "Choose a court or registry." }).nullable(),
  facts: z.record(z.string().max(60), factValue).default({}),
});
export type NewDraft = z.infer<typeof newDraftSchema>;

export const DRAFT_REQUEST_MAX_CHARS = 1000;
export const draftRequestSchema = z.strictObject({
  request: z
    .string()
    .trim()
    .min(3, { error: "Say which document you need." })
    .max(DRAFT_REQUEST_MAX_CHARS, {
      error: `Keep the request under ${DRAFT_REQUEST_MAX_CHARS} characters.`,
    }),
  course: z.string().max(80).default("all"),
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// The student's answers, kept only for the template's own fields, trimmed, with empty answers
// dropped (they stay as placeholders). A date must be a real day, as the date picker gives.
export function factsFor(
  spec: TemplateSpec,
  facts: Record<string, string | string[]>,
): { ok: true; fields: DocumentContent["fields"] } | { ok: false; message: string } {
  const fields: DocumentContent["fields"] = {};
  for (const field of spec.fields) {
    const raw = facts[field.id];
    const values = (Array.isArray(raw) ? raw : [raw ?? ""])
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (!field.repeatable && values.length > 1)
      return { ok: false, message: `${field.label}: give one answer.` };
    if (field.type === "date" && values.some((value) => !ISO_DAY.test(value)))
      return { ok: false, message: `${field.label}: choose a date.` };
    fields[field.id] = field.repeatable ? values : values[0];
  }
  return { ok: true, fields };
}

// ---------------------------------------------------------------------------
// Changing a document (step 5e).
const documentId = z.uuid({ error: "That document could not be found." });
export const editFactsSchema = z.strictObject({
  documentId,
  facts: z.record(z.string().max(60), factValue).default({}),
});
export const editPartSchema = z.strictObject({
  documentId,
  partId: id,
  // null puts the part back to the template's (or Lawdeck's) wording.
  text: z
    .string()
    .trim()
    .min(1, { error: "Write the part, or put back the original wording." })
    .max(20000, { error: "Keep a part under 20,000 characters." })
    .nullable(),
});
export const versionRefSchema = z.strictObject({
  documentId,
  versionId: z.uuid({ error: "That version could not be found." }),
});
export const INSTRUCTION_MAX_CHARS = 1000;
export const instructionSchema = z.strictObject({
  documentId,
  instruction: z
    .string()
    .trim()
    .min(3, { error: "Say what to change." })
    .max(INSTRUCTION_MAX_CHARS, {
      error: `Keep the instruction under ${INSTRUCTION_MAX_CHARS} characters.`,
    }),
});

// The answers one document can pass to a related one (step 5f, DR-09): those to the same
// questions (same name), with one answer kept where the new question takes only one.
export function sharedFacts(
  from: Record<string, string | string[]>,
  fields: TemplateField[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const field of fields) {
    const value = from[field.id];
    const values = (Array.isArray(value) ? value : [value ?? ""]).filter((v) => v.trim());
    if (values.length) out[field.id] = field.repeatable ? values : values.slice(0, 1);
  }
  return out;
}

// A readable name for a part: its heading, or else its first line with each {{fact}} shown by its
// question's label ("IN THE HIGH COURT OF LAGOS STATE", "Dated this … day of …").
export function partLabel(part: TemplatePart, fields: TemplateField[]): string {
  if (part.heading) return part.heading;
  if (part.kind === "signature") return "Signature";
  if (part.kind === "narrative") return "Written from your facts";
  const first = (part.text ?? "").split("\n").find((line) => line.trim()) ?? part.id;
  const named = first.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (_, id: string) => fields.find((f) => f.id === id)?.label ?? id);
  return named.length > 60 ? `${named.slice(0, 57).trimEnd()}…` : named;
}
