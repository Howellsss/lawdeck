import Link from "next/link";
import type { ReactNode } from "react";
import { parseMessage, type Inline } from "@/lib/chatFormat";

// A chat message drawn from Lawdeck's own parser: React elements only, never raw HTML.
function inline(items: Inline[], key = ""): ReactNode[] {
  return items.map((item, i) => {
    const k = `${key}${i}`;
    switch (item.t) {
      case "text":
        return <span key={k}>{item.v}</span>;
      case "bold":
        return <strong key={k} className="font-semibold">{inline(item.c, `${k}-`)}</strong>;
      case "italic":
        return <em key={k}>{inline(item.c, `${k}-`)}</em>;
      case "strike":
        return <s key={k}>{inline(item.c, `${k}-`)}</s>;
      case "code":
        return (
          <code key={k} className="rounded border border-line bg-surface px-1 py-px font-mono text-[13px]">
            {item.v}
          </code>
        );
      case "link":
        return (
          <a key={k} href={item.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all">
            {inline(item.c, `${k}-`)}
          </a>
        );
      case "mention":
        return (
          <span key={k} className="rounded bg-pill px-1 font-medium">
            @{item.name}
          </span>
        );
      case "hashtag":
        return (
          <Link key={k} href={`/chat/search?tag=${item.tag}`} className="font-medium">
            #{item.tag}
          </Link>
        );
    }
  });
}

export function ChatBody({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-1.5 break-words text-[15px] leading-[1.55]">
      {parseMessage(body).map((block, i) => {
        if (block.t === "p")
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(line, `${i}-${j}-`)}
                </span>
              ))}
            </p>
          );
        if (block.t === "ul" || block.t === "ol") {
          const List = block.t;
          return (
            <List key={i} className={`flex flex-col gap-0.5 pl-5 ${block.t === "ul" ? "list-disc" : "list-decimal"}`}>
              {block.items.map((item, j) => (
                <li key={j}>{inline(item, `${i}-${j}-`)}</li>
              ))}
            </List>
          );
        }
        if (block.t === "quote")
          return (
            <blockquote key={i} className="border-l-[3px] border-line pl-3 text-muted">
              {block.lines.map((line, j) => (
                <span key={j} className="block">
                  {inline(line, `${i}-${j}-`)}
                </span>
              ))}
            </blockquote>
          );
        if (block.t === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px]">
              {block.v}
            </pre>
          );
        return null;
      })}
    </div>
  );
}
