import Image from "next/image";

// The Lawdeck mark. Inverted automatically in dark mode (see .brand-mark in globals.css).
export function BrandMark({ size = 28, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/lawdeck-mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className="brand-mark rounded-[22%]"
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-brand font-bold tracking-tight ${className}`}>Lawdeck</span>;
}
