// A row of thin bars rising and falling in a wave while Lawdeck listens (founder, 2026-10-25: "like
// Claude's dictation"). The bars move on their own; they do not follow the voice, because opening
// the microphone a second time stops dictation on some phones. Decorative only: the button says
// "Stop dictation".
const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75, 0.4];

export function VoiceWave({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-5 shrink-0 items-center gap-[3px] ${className}`}>
      {BARS.map((height, index) => (
        <span
          key={index}
          className="voice-wave-bar block w-[3px] rounded-full bg-current"
          style={{ height: `${height * 100}%`, animationDelay: `${index * -0.13}s`, animationDuration: `${0.9 + (index % 3) * 0.15}s` }}
        />
      ))}
    </span>
  );
}
