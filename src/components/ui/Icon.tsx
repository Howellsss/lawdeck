// Simple line icons. Always decorative: the button or link around them carries the label.
const PATHS = {
  plus: "M10 4v12M4 10h12",
  search: "M8.5 14a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM12.5 12.5l4 4",
  book: "M3 4.5h5a2 2 0 012 2V16a1.5 1.5 0 00-1.5-1.5H3zM17 4.5h-5a2 2 0 00-2 2V16a1.5 1.5 0 011.5-1.5H17z",
  folder: "M2.5 5h6l1.5 2h7.5v9h-15z",
  document: "M5 2.5h7l3 3v12H5zM12 2.5v3h3M8 10h5M8 13h5",
  upload: "M10 13V3.5M6 7.5l4-4 4 4M3.5 12.5v4h13v-4",
  pen: "M13.5 3.5l3 3L7 16H4v-3z",
  flag: "M5 17.5V3M5 3.5h9.5l-2 3.5 2 3.5H5",
  cards: "M3.5 6.5h10v10h-10zM6.5 3.5h10v10",
  bookmark: "M5.5 3h9v14l-4.5-3.5L5.5 17z",
  check: "M3.5 3.5h13v13h-13zM7 10l2 2 4-4",
  scale: "M10 3v14M5 17h10M4 7h12M4 7l-2 5h4zM16 7l-2 5h4z",
  menu: "M3 5.5h14M3 10h10M3 14.5h7",
  sidebar: "M3 4h14v12H3zM8 4v12",
  sun: "M10 13a3 3 0 100-6 3 3 0 000 6zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4",
  moon: "M16 12.5A6.5 6.5 0 017.5 4a6.5 6.5 0 108.5 8.5z",
  close: "M5 5l10 10M15 5L5 15",
  arrowUp: "M10 16V4M5 9l5-5 5 5",
  arrowRight: "M4 10h12M11 5l5 5-5 5",
  signOut: "M8 3.5H4.5v13H8M12.5 6.5L16 10l-3.5 3.5M16 10H8",
  chevronDown: "M5 8l5 5 5-5",
  newTask: "M11 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9M15 2.5l2.5 2.5L10 12.5H7.5V10z",
  chat: "M3.5 9.5a6.5 6 0 1112.5 2.3 6.5 6 0 01-7 3.4L4 16.5l1-3.2a5.8 5.8 0 01-1.5-3.8z",
  users: "M7.5 9.5a3 3 0 100-6 3 3 0 000 6zM2 16.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13 3.8a3 3 0 010 5.4M15 11.8c1.8.7 3 2.4 3 4.7",
  mic: "M10 2.5a2.5 2.5 0 00-2.5 2.5v5a2.5 2.5 0 005 0V5A2.5 2.5 0 0010 2.5zM5 9.5a5 5 0 0010 0M10 14.5v3M7 17.5h6",
  stop: "M6 6h8v8H6z",
  expand: "M12 3.5h4.5V8M16.5 3.5L11 9M8 16.5H3.5V12M3.5 16.5L9 11",
  collapse: "M11.5 4v4.5H16M11.5 8.5L17 3M8.5 16v-4.5H4M8.5 11.5L3 17",
  more: "M4 10a1 1 0 102 0 1 1 0 10-2 0zM9 10a1 1 0 102 0 1 1 0 10-2 0zM14 10a1 1 0 102 0 1 1 0 10-2 0z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
