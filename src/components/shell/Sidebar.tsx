"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SidebarContext } from "./sidebarContext";

const MAIN_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/courses", label: "Courses", icon: "book" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/documents", label: "Documents", icon: "document" },
  { href: "/drafting", label: "Drafting catalogue", icon: "pen" },
];

type SidebarProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  closeButton?: React.ReactNode;
  // The account button, checked on the server (see AccountSlot).
  account?: React.ReactNode;
};

export function Sidebar({ collapsed = false, onToggleCollapse, onNavigate, closeButton, account }: SidebarProps) {
  const pathname = usePathname();
  const itemClass = (active: boolean) =>
    `flex h-11 items-center gap-3 rounded-lg px-2 text-[15px] no-underline hover:bg-pill ${
      active ? "bg-pill font-medium" : ""
    } ${collapsed ? "justify-center" : ""}`;
  const label = (text: string) => <span className={collapsed ? "sr-only" : ""}>{text}</span>;

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 bg-sidebar px-3 py-3">
      <div className={`flex items-center gap-2 px-1 ${collapsed ? "flex-col" : "justify-between"}`}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 no-underline" aria-label="Lawdeck home">
          <BrandMark size={26} />
          {!collapsed && <Wordmark className="text-[22px]" />}
        </Link>
        {closeButton}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-pill"
          >
            <Icon name="sidebar" size={18} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <Link href="/" onClick={onNavigate} className={itemClass(false)}>
          <span className="flex size-[26px] items-center justify-center rounded-full bg-pill">
            <Icon name="plus" size={14} />
          </span>
          {label("New task")}
        </Link>
        <Link href="/search" onClick={onNavigate} className={itemClass(pathname === "/search")}>
          <Icon name="search" />
          {label("Search")}
        </Link>
      </div>

      <div className="flex flex-col gap-0.5">
        {MAIN_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={onNavigate} className={itemClass(pathname.startsWith(link.href))}>
            <Icon name={link.icon} />
            {label(link.label)}
          </Link>
        ))}
      </div>

      {!collapsed && (
        <section aria-label="Recents" className="flex flex-col gap-1">
          <h2 className="px-2 text-[13px] font-normal text-muted">Recents</h2>
          <p className="px-2 text-sm text-muted">Your chats will appear here.</p>
        </section>
      )}

      <div className={`mt-auto flex items-center gap-2 border-t border-line pt-3 ${collapsed ? "flex-col" : ""}`}>
        <SidebarContext.Provider value={{ collapsed, onNavigate }}>{account}</SidebarContext.Provider>
        <ThemeToggle />
      </div>
    </nav>
  );
}
