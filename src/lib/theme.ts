export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "lawdeck-theme";
export const DEFAULT_THEME: Theme = "dark";

export function nextTheme(current: string | undefined): Theme {
  return current === "light" ? "dark" : "light";
}
