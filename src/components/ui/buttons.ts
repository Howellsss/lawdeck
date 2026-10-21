// Shared button looks: black filled, or outlined (CLAUDE.md "Look").
export const primaryButton =
  "flex h-14 w-full items-center justify-center rounded-full bg-ink px-6 text-[17px] font-semibold text-on-ink disabled:opacity-60";
export const secondaryButton =
  "flex h-12 w-full items-center justify-center rounded-full border border-line px-6 text-[15px] font-medium text-ink hover:bg-pill disabled:opacity-60";

// Compact versions for forms inside pages.
export const compactPrimaryButton =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-ink px-5 text-[15px] font-medium text-on-ink disabled:opacity-60";
export const compactSecondaryButton =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-line px-5 text-[15px] font-medium text-ink hover:bg-pill disabled:opacity-60";
// For actions that delete something: outlined, with the warning colour for meaning.
export const compactWarningButton =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-warning px-5 text-[15px] font-medium text-warning disabled:opacity-60";
