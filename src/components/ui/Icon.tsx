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
  // A notebook with lines: the Study Diary.
  diary: "M5 2.5h10a1 1 0 011 1v13a1 1 0 01-1 1H5zM7.5 2.5v15M10 6.5h3.5M10 9.5h3.5",
  progress: "M3.5 16.5h13M5.5 16.5v-5M10 16.5v-9M14.5 16.5v-12",
  smile: "M10 17a7 7 0 100-14 7 7 0 000 14zM7 11.5a3.5 3.5 0 006 0M7.5 8h.01M12.5 8h.01",
  paperclip: "M14.5 9l-5.3 5.3a3 3 0 01-4.2-4.2l6-6a2 2 0 012.8 2.8l-6 6a1 1 0 01-1.4-1.4L11.5 6.5",
  link: "M8.5 11.5l3-3M9.5 6l1.2-1.2a3 3 0 014.2 4.2L13.7 10.2M10.5 14l-1.2 1.2a3 3 0 01-4.2-4.2L6.3 9.8",
  listBullet: "M8 5.5h9M8 10h9M8 14.5h9M4 5.5h.01M4 10h.01M4 14.5h.01",
  listNumber: "M8 5.5h9M8 10h9M8 14.5h9M3.5 4.5l1-.5v3.2M3.2 9.4a1 1 0 011.7.7L3.2 11.8h1.9M3.3 13.4h1.6l-1 1.1a.9.9 0 11-.6 1.5",
  quote: "M4.5 5.5v9M8.5 6.5h8M8.5 10h8M8.5 13.5h5",
  code: "M7 6l-4 4 4 4M13 6l4 4-4 4",
  send: "M3.5 10h12M11 5.5l4.5 4.5-4.5 4.5",
  hash: "M7.5 3.5l-2 13M14.5 3.5l-2 13M4 7.5h13M3 12.5h13",
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
  speaker: "M3.5 7.5h3l4-3.5v12l-4-3.5h-3zM13.5 7a4 4 0 010 6M15.5 4.5a7 7 0 010 11",
  pause: "M7 5v10M13 5v10",
  play: "M6.5 4.5l9 5.5-9 5.5z",
  waveform: "M3 9v2M6 6.5v7M9 4v12M12 7v6M15 5.5v9M18 9v2",
  expand: "M12 3.5h4.5V8M16.5 3.5L11 9M8 16.5H3.5V12M3.5 16.5L9 11",
  collapse: "M11.5 4v4.5H16M11.5 8.5L17 3M8.5 16v-4.5H4M8.5 11.5L3 17",
  more: "M4 10a1 1 0 102 0 1 1 0 10-2 0zM9 10a1 1 0 102 0 1 1 0 10-2 0zM14 10a1 1 0 102 0 1 1 0 10-2 0z",
  // Study group calls.
  phone: "M5.5 3h2.5l1.5 4-2 1.5a8 8 0 004 4l1.5-2 4 1.5v2.5a1.5 1.5 0 01-1.5 1.5A13.5 13.5 0 014 4.5 1.5 1.5 0 015.5 3z",
  video: "M2.5 5.5h10v9h-10zM12.5 8.5l5-3v9l-5-3",
  videoOff: "M2.5 5.5h10v9h-10zM12.5 8.5l5-3v9l-5-3M2 3l16 14",
  micOff: "M10 2.5a2.5 2.5 0 00-2.5 2.5v5a2.5 2.5 0 005 0V5A2.5 2.5 0 0010 2.5zM5 9.5a5 5 0 0010 0M10 14.5v3M7 17.5h6M3 3l14 14",
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
