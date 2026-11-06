import type { ChatGroup, ChatInvite, ChatMessage } from "@/server/chat/data";

// Made-up groups, people and messages for the campus chat test pages.
export const groupId = "00000000-0000-4000-8000-000000000801";
export const groups: ChatGroup[] = [
  { id: "00000000-0000-4000-8000-000000000800", key: "all-campuses", name: "All campuses", kind: "all", unread: 3, members: 214, mine: false },
  { id: groupId, key: "lagos", name: "Lagos", kind: "campus", unread: 0, members: 42, mine: false },
  { id: "00000000-0000-4000-8000-000000000802", key: "abuja", name: "Abuja", kind: "campus", unread: 12, members: 38, mine: false },
  { id: "00000000-0000-4000-8000-000000000803", key: "aspirant", name: "Aspirants", kind: "aspirants", unread: 0, members: 17, mine: false },
  { id: "00000000-0000-4000-8000-000000000804", key: "s-civillitxx", name: "Civil Lit squad", kind: "study", unread: 2, members: 5, mine: true },
];
const ada = { id: "00000000-0000-4000-8000-000000000811", name: "Ada Wombat", campus: "Lagos" };
const tunde = { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja" };
const msg = (n: number, author: typeof ada, at: string, body: string, mine = false): ChatMessage => ({
  id: `00000000-0000-4000-8000-00000000082${n}`,
  groupId,
  body,
  createdAt: at,
  author,
  mine,
  files: [],
});
const now = Date.now();
const today = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
export const messages: ChatMessage[] = [
  msg(1, tunde, new Date(now - 26 * 3_600_000).toISOString(), "Has anyone got the **Civil Litigation** notes on _Order 3_? #civil"),
  msg(2, ada, today(40), `Yes! See [the summary](https://mylawdeck.com/diary) @[Tunde Quokka](${tunde.id})\n- Originating summons\n- Writ of summons`),
  msg(3, ada, today(38), "> Facts not in dispute: use an originating summons", true),
  msg(4, tunde, today(5), "Thanks, that helps ~~a little~~ a lot. `Order 3 rule 5` is the one."),
  {
    ...msg(5, tunde, today(3), "Here is the class handout."),
    files: [
      { name: "Order 3 handout.pdf", kind: "pdf", size: 482_000, url: null },
      { name: "Board notes.png", kind: "png", size: 1_300_000, url: null },
    ],
  },
];

export const invites: ChatInvite[] = [{ groupId: "00000000-0000-4000-8000-000000000805", groupName: "Criminal Lit night class", invitedBy: "Tunde Quokka" }];
