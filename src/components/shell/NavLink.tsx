"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type NavLinkProps = {
  href: string;
  className: (active: boolean) => string;
  onNavigate?: () => void;
  // "exact" for one page, "prefix" for a section such as /projects and /projects/…
  match?: "exact" | "prefix";
  children: ReactNode;
};

// A menu link that highlights itself on its own page. Reading the address happens in a
// small boundary, so pages with ids in the address can still load their shell instantly.
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<PlainLink {...props} active={false} />}>
      <ActiveLink {...props} />
    </Suspense>
  );
}

function ActiveLink(props: NavLinkProps) {
  const pathname = usePathname();
  const active =
    props.match === "prefix"
      ? pathname === props.href || pathname.startsWith(`${props.href}/`)
      : pathname === props.href;
  return <PlainLink {...props} active={active} />;
}

function PlainLink({ href, className, onNavigate, children, active }: NavLinkProps & { active: boolean }) {
  return (
    <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={className(active)}>
      {children}
    </Link>
  );
}
