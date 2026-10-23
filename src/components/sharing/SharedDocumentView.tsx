import { notFound } from "next/navigation";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatWat } from "@/lib/dates";
import { getSharedDocument } from "@/server/db/sharing";
import { SharedPages } from "./SharedPages";

// One shared document: its title, court and pages. Missing (or outside the shared work): not found.
export async function SharedDocumentView({ token, id }: { token: string; id: string }) {
  const document = await getSharedDocument(token, id);
  if (!document) notFound();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{document.title}</h1>
        <p className="text-sm text-muted">{[document.forumName, `Updated ${formatWat(document.updatedAt)}`].filter(Boolean).join(" · ")}</p>
      </div>
      {document.model ? (
        <SharedPages model={document.model} />
      ) : (
        <StateMessage level={2} title="Being re-checked">
          The template or court format for this document is being reviewed again, so it can’t be shown just now. Please check back later.
        </StateMessage>
      )}
    </>
  );
}
