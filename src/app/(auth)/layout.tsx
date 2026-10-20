import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Full-screen layout for the sign-in screens (design board M1): no sidebar, one calm column.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-paper px-4 pb-8 pt-6 text-ink sm:px-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Lawdeck home">
          <BrandMark size={28} />
          <Wordmark className="text-[24px]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col items-center justify-center gap-8 py-10">
        {children}
      </main>
    </div>
  );
}
