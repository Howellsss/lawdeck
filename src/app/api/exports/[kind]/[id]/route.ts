import { exportRequestSchema } from "@/schemas/exports";
import { getCurrentAccount } from "@/server/auth/session";
import { sheetToDocx } from "@/server/exports/docx";
import { exportFileName, loadSheet } from "@/server/exports/load";
import { recordDownload } from "@/server/monitoring/downloads";

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// The Word file of one of the student's own chats (as notes), briefs or practice sets (PRD
// EX-03). Sign-in is checked here; row-level security returns the student's own rows only.
export async function GET(request: Request, ctx: RouteContext<"/api/exports/[kind]/[id]">) {
  if (!(await getCurrentAccount())) return refuse(401, "Sign in to download your work.");
  const { kind, id } = await ctx.params;
  const parsed = exportRequestSchema.safeParse({ kind, id, notKnown: new URL(request.url).searchParams.get("notKnown") === "1" });
  if (!parsed.success) return refuse(404, "That could not be found.");

  let loaded: Awaited<ReturnType<typeof loadSheet>>;
  try {
    loaded = await loadSheet(parsed.data);
  } catch {
    return refuse(500, "That could not be loaded. Please try again.");
  }
  if (loaded.status === "signed-out") return refuse(401, "Sign in to download your work.");
  if (!loaded.data) return refuse(404, "That could not be found.");

  const file = await sheetToDocx(loaded.data);
  await recordDownload("study_export");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${exportFileName(loaded.data.title)}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
