import "server-only";
import { parseChoices, parsePracticeSources, type PracticeReveal } from "@/lib/practice";
import { practiceSetIdSchema } from "@/schemas/practice";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reads for the practice screens (Phase 4). Sign-in is checked first; row-level security keeps
// every set, question and answer to its owner.

export type PracticeSetSummary = {
  id: string;
  title: string;
  kind: "mcq" | "scenario" | "flashcards";
  createdAt: string;
  questions: number;
  answered: number;
};

export type PracticeItemView = {
  id: string;
  question: string;
  choices: string[] | null;
  // Multiple choice already answered: the option picked and what it revealed.
  chosen: number | null;
  reveal: PracticeReveal | null;
};

export type PracticeSetView = {
  id: string;
  title: string;
  kind: "mcq" | "scenario" | "flashcards";
  courseId: string;
  createdAt: string;
  items: PracticeItemView[];
};

function failed(what: string, code: string | undefined): never {
  console.error("practice read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function listPracticeSets(): Promise<Loaded<PracticeSetSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const sets = await supabase.from("practice_sets").select("id, title, kind, created_at").order("created_at", { ascending: false }).limit(100);
  if (sets.error) failed("practice sets", sets.error.code);
  const ids = sets.data.map((s) => s.id);
  const items = ids.length ? await supabase.from("practice_items").select("id, set_id").in("set_id", ids) : { data: [], error: null };
  if (items.error) failed("practice items", items.error.code);
  const itemIds = items.data.map((i) => i.id);
  const attempts = itemIds.length ? await supabase.from("attempts").select("item_id").in("item_id", itemIds) : { data: [], error: null };
  if (attempts.error) failed("attempts", attempts.error.code);
  const answered = new Set(attempts.data.map((a) => a.item_id));
  return {
    status: "ok",
    data: sets.data.map((s) => {
      const own = items.data.filter((i) => i.set_id === s.id);
      return {
        id: s.id,
        title: s.title,
        kind: s.kind,
        createdAt: s.created_at,
        questions: own.length,
        answered: own.filter((i) => answered.has(i.id)).length,
      };
    }),
  };
}

// One set with its questions. Answers stay on the server until the student answers a multiple
// choice question or asks to see a model answer.
export async function getPracticeSet(id: string): Promise<Loaded<PracticeSetView | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!practiceSetIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const set = await supabase.from("practice_sets").select("id, title, kind, course_id, created_at").eq("id", id).maybeSingle();
  if (set.error) failed("practice set", set.error.code);
  if (!set.data) return { status: "ok", data: null };
  const items = await supabase
    .from("practice_items")
    .select("id, position, question, choices, correct_choice, answer, sources")
    .eq("set_id", id)
    .order("position");
  if (items.error) failed("practice items", items.error.code);
  const itemIds = items.data.map((i) => i.id);
  const attempts = itemIds.length
    ? await supabase.from("attempts").select("item_id, choice, created_at").in("item_id", itemIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (attempts.error) failed("attempts", attempts.error.code);

  return {
    status: "ok",
    data: {
      id: set.data.id,
      title: set.data.title,
      kind: set.data.kind,
      courseId: set.data.course_id,
      createdAt: set.data.created_at,
      items: items.data.map((item) => {
        const latest = attempts.data.find((a) => a.item_id === item.id && a.choice !== null);
        const choices = parseChoices(item.choices);
        const chosen = choices && latest ? latest.choice : null;
        return {
          id: item.id,
          question: item.question,
          choices,
          chosen,
          reveal:
            chosen !== null
              ? { answer: item.answer, correctChoice: item.correct_choice, sources: parsePracticeSources(item.sources) }
              : null,
        };
      }),
    },
  };
}
