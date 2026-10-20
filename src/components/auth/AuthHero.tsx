import { BrandMark } from "@/components/ui/BrandMark";

// Logo, headline and one line of text at the top of each sign-in screen (design board M1).
export function AuthHero({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <BrandMark size={88} priority />
      <h1 className="font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-greeting sm:text-[40px]">
        {title}
      </h1>
      {children && <div className="max-w-[320px] text-base leading-normal text-muted">{children}</div>}
    </div>
  );
}
