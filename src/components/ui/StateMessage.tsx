import Link from "next/link";
import type { ReactNode } from "react";

// The standard empty / error / not-yet-available message (rule I-01): what happened, and a next step.
export function StateMessage({
  title,
  children,
  action,
  tone = "neutral",
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; href: string } | ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <h1 className={`font-serif text-3xl font-normal ${tone === "warning" ? "text-warning" : "text-greeting"}`}>
        {title}
      </h1>
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
