// "Good morning / afternoon / evening" from the student's own clock.
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// The first name to greet someone by, from a full name: the first word, at most 40 characters.
// Nothing if the name is empty or has no letters.
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/\p{L}/u.test(first)) return null;
  return first.slice(0, 40);
}
