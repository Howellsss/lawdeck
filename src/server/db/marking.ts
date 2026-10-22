import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reads for "Mark my answer" (step 4e): approved exam-style questions only, without their marking
// points (those are shown after marking).

export type MarkingQuestion = {
  id: string;
  title: string;
  question: string;
  courseName: string;
  topicName: string | null;
  totalMarks: number;
};

export async function listMarkingQuestions(): Promise<Loaded<MarkingQuestion[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("marking_questions", {});
  if (error) {
    console.error("marking read failed", { what: "questions", code: error.code });
    throw new WorkspaceLoadError("marking questions");
  }
  return {
    status: "ok",
    data: data.map((q) => ({
      id: q.id,
      title: q.title,
      question: q.question,
      courseName: q.course_name,
      topicName: q.topic_name,
      totalMarks: q.total_marks,
    })),
  };
}
