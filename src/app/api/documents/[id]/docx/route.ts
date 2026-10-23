import { draftingIdSchema } from "@/schemas/drafting";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { loadDocument } from "@/server/db/documents";
import { documentToDocx } from "@/server/documents/docx";

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// The Word file of one of the student's own documents (PRD EX-01), drawn from the same model as
// the on-screen page (rule H-04). Sign-in is checked here; row-level security returns the
// document to its owner only, so anyone else gets "not found".
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]/docx">) {
  const account = await getCurrentAccount();
  if (!account) return refuse(401, "Sign in to download your documents.");
  const { id } = await ctx.params;
  if (!draftingIdSchema.safeParse(id).success) return refuse(404, "That document could not be found.");

  const supabase = await createSupabaseServerClient();
  let loaded: Awaited<ReturnType<typeof loadDocument>>;
  try {
    loaded = await loadDocument(supabase, id);
  } catch {
    return refuse(500, "The document could not be loaded. Please try again.");
  }
  if (!loaded) return refuse(404, "That document could not be found.");
  if (!loaded.model) return refuse(409, "This document is being re-checked and can’t be downloaded just now.");

  const file = await documentToDocx(loaded.model);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName(loaded.document.title)}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// A safe file name from the title: letters, numbers, spaces and hyphens only.
function fileName(title: string): string {
  return title.replace(/[^A-Za-z0-9 -]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Lawdeck document";
}
