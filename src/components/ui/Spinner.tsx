// A small dot orbiting a faint ring, for busy buttons ("Drafting…"). Decorative only: the button's
// words say what is happening.
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="orbit shrink-0" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.6} />
      <circle cx="8" cy="2" r="1.8" fill="currentColor" />
    </svg>
  );
}
