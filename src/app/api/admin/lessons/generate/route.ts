import type { NextRequest } from "next/server";
import { topicIdSchema } from "@/schemas/lesson";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { generateLesson } from "@/server/lessons/generate";

// Writing a lesson with Opus takes a few minutes (rule G-10: the call itself stops at 4.5).
export const maxDuration = 300;

function refuse(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}

// Admin → Lessons: a reviewer or admin asks Lawdeck to write (or rewrite) a topic's lesson for
// review (docs/specs/remembrance.md). Students cannot use it; the database also refuses them.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return refuse(403, "Not allowed.");
  if (!(await getStaffRole())) return refuse(404, "Not found.");
  const body = await request.json().catch(() => null);
  const topicId = topicIdSchema.safeParse(body?.topicId);
  if (!topicId.success) return refuse(400, "That topic could not be found.");
  const result = await generateLesson(await createSupabaseServerClient(), topicId.data);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
