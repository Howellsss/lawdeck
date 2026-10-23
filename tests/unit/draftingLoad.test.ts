import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE, templateFileSchema } from "@/schemas/drafting";
import { planLoad, sameJson } from "@/server/documents/plan";

// Made-up courts and templates only. A pretend database: nothing real is touched.
const forumFile = (over: Record<string, unknown> = {}) => ({
  slug: "quokka-court",
  name: "Quokka Court",
  kind: "court",
  state: "Quokka",
  profile: DEFAULT_PROFILE,
  ...over,
});
const templateFile = (over: Record<string, unknown> = {}) => ({
  slug: "wombat-notice",
  title: "Wombat notice",
  course: "civil-litigation",
  forums: ["quokka-court"],
  ruleSource: "Quokka Rules, Form 9",
  spec: {
    parts: [
      {
        id: "body",
        kind: "fixed",
        text: "To {{party}}.",
        required: true,
        why: "Tells the party.",
      },
    ],
    fields: [
      {
        id: "party",
        label: "Party",
        type: "party",
        required: true,
        question: "Who?",
        placeholder: "PARTY’S NAME",
      },
    ],
    changeLog: [{ date: "2026-10-23", note: "First draft." }],
  },
  ...over,
});
const courses = [{ id: "c1", slug: "civil-litigation" }];

describe("planning a load", () => {
  it("adds new files", () => {
    const plan = planLoad({
      forumFiles: [forumFile()],
      templateFiles: [templateFile()],
      forums: [],
      templates: [],
      courses,
    });
    expect(plan.forums).toMatchObject([{ action: "add" }]);
    expect(plan.templates).toMatchObject([{ action: "add", courseId: "c1" }]);
    expect(plan.problems).toEqual([]);
  });

  it("leaves unchanged files alone, whatever order the database returns keys in", () => {
    // What the database holds after a load (the checked file), with its keys in reverse order.
    const stored = templateFileSchema.parse(templateFile()).spec;
    const parsedSpec = Object.fromEntries(Object.entries(stored).reverse());
    const plan = planLoad({
      forumFiles: [forumFile()],
      templateFiles: [templateFile()],
      forums: [
        {
          id: "f1",
          slug: "quokka-court",
          name: "Quokka Court",
          kind: "court",
          state: "Quokka",
          profile: { ...DEFAULT_PROFILE },
        },
      ],
      templates: [
        {
          id: "t1",
          slug: "wombat-notice",
          title: "Wombat notice",
          course_id: "c1",
          spec: parsedSpec,
          rule_source: "Quokka Rules, Form 9",
        },
      ],
      courses,
    });
    expect(plan.forums).toEqual([]);
    expect(plan.templates).toMatchObject([{ action: "links", id: "t1" }]);
    expect(plan.unchanged).toBe(2);
  });

  it("updates changed files", () => {
    const plan = planLoad({
      forumFiles: [
        forumFile({ profile: { ...DEFAULT_PROFILE, fontSizePt: 13 } }),
      ],
      templateFiles: [templateFile({ title: "Wombat notice (new)" })],
      forums: [
        {
          id: "f1",
          slug: "quokka-court",
          name: "Quokka Court",
          kind: "court",
          state: "Quokka",
          profile: DEFAULT_PROFILE,
        },
      ],
      templates: [
        {
          id: "t1",
          slug: "wombat-notice",
          title: "Wombat notice",
          course_id: "c1",
          spec: {},
          rule_source: "Quokka Rules, Form 9",
        },
      ],
      courses,
    });
    expect(plan.forums).toMatchObject([{ action: "update", id: "f1" }]);
    expect(plan.templates).toMatchObject([{ action: "update", id: "t1" }]);
  });

  it("reports files that fail the checks, name unknown courses or courts, and loads nothing for them", () => {
    const plan = planLoad({
      forumFiles: [forumFile({ kind: "tribunal" })],
      templateFiles: [
        templateFile({ course: "space-law" }),
        templateFile({ slug: "other", forums: ["moon-court"] }),
        "not a file",
      ],
      forums: [],
      templates: [],
      courses,
    });
    expect(plan.forums).toEqual([]);
    expect(plan.templates).toEqual([]);
    expect(plan.problems.map((p) => p.file)).toEqual([
      "quokka-court",
      "wombat-notice",
      "other",
      "template file 3",
    ]);
    expect(plan.problems[1].issues[0]).toContain('no course "space-law"');
    expect(plan.problems[2].issues).toEqual([
      'forums: there is no court or registry "moon-court".',
    ]);
  });

  it("compares JSON by content", () => {
    expect(
      sameJson(
        { a: 1, b: [1, { c: 2, d: 3 }] },
        { b: [1, { d: 3, c: 2 }], a: 1 },
      ),
    ).toBe(true);
    expect(sameJson({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });
});

// The reviewer actions, with a pretend role check and database.
const role = vi.fn();
const single = vi.fn();
const updated = vi.fn();
vi.mock("@/server/auth/roles", () => ({ getStaffRole: role }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: single }) }),
      update: (row: unknown) => ({
        eq: () => ({ select: async () => updated(row) }),
      }),
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: [{ id: "x" }], error: null }),
        }),
      }),
    }),
  }),
}));
const {
  setTemplateStatus,
  setForumStatus,
  deleteDraftingItem,
  loadTemplateFiles,
} = await import("@/server/documents/actions");
const ID = "11111111-1111-4111-8111-111111111111";

describe("reviewer actions", () => {
  beforeEach(() => {
    for (const fn of [role, single, updated]) fn.mockReset();
    role.mockResolvedValue("reviewer");
    updated.mockReturnValue({ data: [{ id: ID }], error: null });
  });

  it("refuses anyone who is not a reviewer or admin", async () => {
    role.mockResolvedValue(null);
    expect(await setTemplateStatus(ID, "approved")).toEqual({
      ok: false,
      message: "Only reviewers and admins can change templates.",
    });
    expect((await loadTemplateFiles()).ok).toBe(false);
    expect(updated).not.toHaveBeenCalled();
  });

  it("will not approve a template that fails the checks, and says why", async () => {
    single.mockResolvedValue({
      data: { spec: { parts: [] }, rule_source: "Form 9" },
      error: null,
    });
    const result = await setTemplateStatus(ID, "approved");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues?.length).toBeGreaterThan(0);
    expect(updated).not.toHaveBeenCalled();
  });

  it("approves a template that passes the checks", async () => {
    single.mockResolvedValue({
      data: { spec: templateFile().spec, rule_source: "Quokka Rules, Form 9" },
      error: null,
    });
    expect(await setTemplateStatus(ID, "approved")).toEqual({ ok: true });
    expect(updated).toHaveBeenCalledWith({ status: "approved" });
  });

  it("will not approve a forum with a broken profile, but can always withdraw", async () => {
    single.mockResolvedValue({
      data: { profile: { paper: "A4" } },
      error: null,
    });
    expect((await setForumStatus(ID, "approved")).ok).toBe(false);
    expect(await setForumStatus(ID, "withdrawn")).toEqual({ ok: true });
    expect(await setForumStatus(ID, "rejected")).toMatchObject({ ok: false });
  });

  it("lets only admins delete", async () => {
    expect((await deleteDraftingItem("template", ID)).ok).toBe(false);
    role.mockResolvedValue("admin");
    expect(await deleteDraftingItem("template", ID)).toEqual({ ok: true });
  });
});
