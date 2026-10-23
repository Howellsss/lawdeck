"use client";

import { PageView } from "@/components/draft/preview/PagedPreview";
import type { DocModel } from "@/server/documents/render";

// A shared document's pages, read-only: the same drawing as the owner's preview (rule H-04).
// The hidden page measurer is page-wide, so it is clipped to keep phones from scrolling sideways.
export function SharedPages({ model }: { model: DocModel }) {
  return (
    <div className="relative w-full min-w-0 overflow-x-clip">
      <PageView model={model} caption="View only" />
    </div>
  );
}
