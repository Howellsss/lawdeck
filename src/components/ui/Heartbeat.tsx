// A heart-rate-monitor line that moves while Lawdeck is working (searching the library, listening).
// Two identical beats side by side slide left in a loop, so the line never jumps. Decorative only:
// the words next to it say what is happening.
const BEAT = "M0 10 H14 L17 4 L20 16 L23 1 L26 19 L29 10 H44";

export function Heartbeat({ width = 44, className = "" }: { width?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 overflow-hidden ${className}`} style={{ width, height: 20 }}>
      <svg className="heartbeat-track block" width={width * 2} height={20} viewBox="0 0 88 20" fill="none">
        <path d={BEAT} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d={BEAT} transform="translate(44 0)" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
