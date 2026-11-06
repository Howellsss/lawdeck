"use client";

import Link from "next/link";
import { safeNextPath } from "@/lib/safeNextPath";
import { useQuery } from "./useQuery";

// "Create an account" from the sign-in page, keeping where the person was going (for example a
// study group invite link), so they land there once their account is ready.
export function SignUpLink() {
  const next = safeNextPath(useQuery().get("next"));
  return <Link href={next === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link>;
}
