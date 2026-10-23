import { connection } from "next/server";
import { documentToDocx } from "@/server/documents/docx";
import { sampleModel, testPagesEnabled } from "../../sample";

// Export test only (step 5h): the Word file of the same made-up document as /test-pages/document.
// "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
export async function GET(request: Request) {
  await connection(); // decided at request time, never when the app is built
  if (!testPagesEnabled()) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const model = sampleModel(url.searchParams.get("t") ?? "", url.searchParams.get("f") || null);
  if (!model) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await documentToDocx(model)), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  });
}
