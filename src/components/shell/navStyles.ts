// One row style for the side menu, so every link sits on the same quiet rhythm (founder,
// 2026-11-05: "the sophistication that Claude has"): 36px rows, 14px text, soft hover.
export function navItemClass(active: boolean, collapsed: boolean): string {
  return `flex h-9 items-center gap-2.5 rounded-lg px-2 text-[14px] no-underline hover:bg-pill ${
    active ? "bg-pill font-medium text-ink" : "text-ink/90"
  } ${collapsed ? "justify-center" : ""}`;
}

export const NAV_ICON_SIZE = 17;
