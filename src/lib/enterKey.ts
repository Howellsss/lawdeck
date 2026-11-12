// What the Enter key does in Lawdeck's writing boxes (founder, 2026-11-12: "when I press return it
// should go to the next line, not search").
// - Questions to Lawdeck (the main box and follow-ups): Enter always starts a new line. The arrow
//   button sends, and on a computer Ctrl + Enter (⌘ + Enter on a Mac) sends too.
// - Campus chat: on a phone or tablet Enter starts a new line, as in WhatsApp; on a computer Enter
//   sends and Shift + Enter starts a new line, as in Slack.

type KeyEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  nativeEvent: { isComposing?: boolean };
};

// A touch screen without a mouse or trackpad: phones and most tablets.
export function isTouchOnly(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
}

// Questions to Lawdeck: only Ctrl/⌘ + Enter sends.
export function sendsQuestion(event: KeyEvent): boolean {
  return event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing;
}

// Campus chat: Enter sends on a computer, never on a touch-only screen.
export function sendsChatMessage(event: KeyEvent, touchOnly: boolean): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !touchOnly;
}
