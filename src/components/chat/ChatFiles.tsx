import { Icon } from "@/components/ui/Icon";
import { fileSize, isImage, kindLabel } from "@/lib/chatFiles";
import type { ChatFile } from "@/server/chat/data";

// Files in a message: pictures as small previews, documents as cards with name, kind and size.
// Links are short-lived and private to people in the group.
export function ChatFiles({ files }: { files: ChatFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2" aria-label="Attached files">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`}>
          {isImage(f.kind) && f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line" aria-label={`Open picture ${f.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private short-lived links; not optimisable */}
              <img src={f.url} alt={f.name} className="max-h-60 max-w-[min(18rem,70vw)] object-cover" loading="lazy" />
            </a>
          ) : (
            <FileCard file={f} />
          )}
        </li>
      ))}
    </ul>
  );
}

function FileCard({ file }: { file: ChatFile }) {
  const inner = (
    <>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-pill">
        <Icon name="document" size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-[14px] font-medium ${file.url ? "underline underline-offset-2" : ""}`}>{file.name}</span>
        <span className="text-[12px] text-muted">
          {kindLabel(file.kind)} · {fileSize(file.size)}
          {!file.url && " · not available"}
        </span>
      </span>
    </>
  );
  const cls = "flex w-64 max-w-[70vw] items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2";
  return file.url ? (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-muted`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
