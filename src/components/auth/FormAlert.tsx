// A message at the top of a form. Errors are announced to screen readers straight away.
export function FormAlert({ message, tone = "warning" }: { message?: string; tone?: "warning" | "success" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "warning" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed ${
        tone === "warning" ? "border-warning text-warning" : "border-success text-success"
      }`}
    >
      {message}
    </p>
  );
}
