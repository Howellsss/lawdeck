import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatWat } from "@/lib/dates";

// A list of projects or chats: name, link, and when it last changed (in WAT).
export function ItemList({
  items,
  hrefFor,
  icon,
  label,
}: {
  items: { id: string; name: string; updatedAt: string }[];
  hrefFor: (id: string) => string;
  icon: IconName;
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={hrefFor(item.id)}
            className="flex min-h-14 items-center gap-3 px-4 py-3 no-underline hover:bg-pill focus-visible:bg-pill"
          >
            <Icon name={icon} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{item.name}</span>
            <span className="hidden shrink-0 text-sm text-muted sm:inline">Updated {formatWat(item.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
