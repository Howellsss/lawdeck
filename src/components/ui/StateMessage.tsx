import Link from "next/link";
import type { ReactNode } from "react";

// The standard empty / error / not-yet-available message (rule I-01): what happened, and a next step.
export function StateMessage({
  title,
  children,
  action,
  tone = "neutral",
  level = 1,
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; href: string } | ReactNode;
  tone?: "neutral" | "warning";
  // 2 when the page already has its own main heading.
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <Heading className={`font-serif text-3xl font-normal ${tone === "warning" ? "text-warning" : "text-greeting"}`}>
        {title}
      </Heading>
      {children && <div className="text-base leading-relaxed text-muted">{children}</div>}
      {action && isLinkAction(action) ? (
        <Link href={action.href} className="mt-2">
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

function isLinkAction(action: unknown): action is { label: string; href: string } {
  return typeof action === "object" && action !== null && "href" in action && "label" in action;
}
