import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Lawdeck's public policy pages (/privacy, /terms): no sidebar, one readable column, open to
// everyone, signed in or not.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-paper px-4 pb-10 pt-6 text-ink sm:px-6">
      <header className="mx-auto flex w-full max-w-[720px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Lawdeck home">
          <BrandMark size={28} />
          <Wordmark className="text-[24px]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-[720px] py-10">{children}</main>
      <footer className="mx-auto flex w-full max-w-[720px] flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-[14px] text-muted">
        <Link href="/privacy">Privacy Notice</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/takedown">Request removal of material</Link>
      </footer>
    </div>
  );
}
