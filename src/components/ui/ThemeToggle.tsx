"use client";

import { nextTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import { Icon } from "./Icon";

// Switches between dark (default) and light, and remembers the choice on this device.
// Which icon shows is decided by CSS, so it is right even before JavaScript loads.
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const theme = nextTheme(root.dataset.theme);
    root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private browsing can block storage; the switch still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between dark and light mode"
      title="Switch between dark and light mode"
      className={`flex size-10 items-center justify-center rounded-full border border-line text-ink hover:bg-pill ${className}`}
    >
      <Icon name="sun" size={18} className="only-dark" />
      <Icon name="moon" size={18} className="only-light" />
    </button>
  );
}
