"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Account } from "@/server/auth/session";
import { signOut } from "@/server/auth/actions";
import { useSidebar } from "./sidebarContext";

const row = "flex h-11 items-center gap-3 rounded-lg px-2 text-[15px] no-underline hover:bg-pill";

// Bottom of the sidebar: "Sign in" for visitors; the student's email (linking to their Account page)
// and "Sign out" once signed in.
export function AccountButton({ account }: { account: Account | null }) {
  const { collapsed, onNavigate } = useSidebar();
  const label = (text: string) => <span className={collapsed ? "sr-only" : "truncate"}>{text}</span>;

  if (!account) {
    return (
      <Link href="/sign-in" onClick={onNavigate} className={`${row} flex-1 ${collapsed ? "justify-center" : ""}`}>
        <Avatar letter="?" />
        {label("Sign in")}
      </Link>
    );
  }

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
      <Link
        href="/account"
        onClick={onNavigate}
        title="Account"
        className={`${row} min-w-0 flex-1 px-2 ${collapsed ? "justify-center" : ""}`}
      >
        <Avatar letter={account.email.charAt(0).toUpperCase() || "L"} />
        {label(account.email)}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
        >
          <Icon name="signOut" size={18} />
        </button>
      </form>
    </div>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pill text-sm font-semibold"
    >
      {letter}
    </span>
  );
}

// Shown for a moment while the sign-in check runs.
export function AccountButtonPlaceholder() {
  return <span aria-hidden="true" className="h-11 flex-1" />;
}
