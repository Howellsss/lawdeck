import { Icon } from "@/components/ui/Icon";
import { linksIn } from "@/lib/chatFormat";
import { dayLabel, watDay, watTime } from "@/lib/chatTime";
import type { ChatMessage } from "@/server/chat/data";
import { ChatFiles } from "./ChatFiles";

// A group's "Files & links": every file and web link shared there, newest first, with who shared it
// and when.
export function SharedList({ items, groupName }: { items: ChatMessage[]; groupName: string }) {
  if (items.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center">
        <p className="font-serif text-2xl">Nothing shared yet</p>
        <p className="max-w-md text-[15px] text-muted">Files and links shared in {groupName} will be listed here, so they&rsquo;re easy to find later.</p>
      </div>
    );
  return (
    <ol aria-label={`Files and links in ${groupName}`} className="flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto">
      {items.map((m) => {
        const links = linksIn(m.body);
        return (
          <li key={m.id} className="flex flex-col gap-1 px-4 py-3 lg:px-6">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
              <span className="font-semibold text-ink">{m.author.name}</span>
              {m.author.campus && <span>{m.author.campus}</span>}
              <time dateTime={m.createdAt}>
                {dayLabel(watDay(m.createdAt))}, {watTime(m.createdAt)}
              </time>
            </p>
            <ChatFiles files={m.files} />
            {links.length > 0 && (
              <ul className="flex flex-col gap-1">
                {links.map((l, i) => (
                  <li key={`${l.href}-${i}`} className="flex min-w-0 items-center gap-2 text-[14px]">
                    <Icon name="link" size={14} />
                    <a href={l.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="truncate font-medium">
                      {l.label}
                    </a>
                    {l.label !== l.href && <span className="truncate text-[12px] text-muted">{new URL(l.href).hostname}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
