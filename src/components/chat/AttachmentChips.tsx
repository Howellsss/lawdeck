import { Icon } from "@/components/ui/Icon";
import { fileSize } from "@/lib/chatFiles";
import type { Pending } from "./useAttachments";

// Files waiting to go with the next message, with upload progress and a remove button.
export function AttachmentChips({ files, onRemove }: { files: Pending[]; onRemove: (key: string) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-2" aria-label="Files to send">
      {files.map((f) => (
        <li key={f.key} className="flex max-w-[16rem] items-center gap-2 rounded-lg border border-line bg-paper py-1 pl-2 pr-1 text-[13px]">
          <Icon name="document" size={16} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{f.name}</span>
            <span className="text-[12px] text-muted">{f.done ? fileSize(f.size) : `Uploading… ${f.progress}%`}</span>
          </span>
          <button type="button" onClick={() => onRemove(f.key)} aria-label={`Remove ${f.name}`} className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-pill hover:text-ink">
            <Icon name="close" size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
