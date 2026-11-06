import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Campus chat reads (docs/specs/chat.md). Row-level security decides who sees what: staff only in
// Phase 2, students once an admin opens chat; hidden messages are left out for students.

export type ChatGroup = { id: string; key: string; name: string; kind: "all" | "campus" | "aspirants"; unread: number };
export type ChatPerson = { id: string; name: string; campus: string | null };
export type ChatMessage = { id: string; groupId: string; body: string; createdAt: string; author: ChatPerson; mine: boolean };

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export const PAGE = 50;

export async function chatAllowed(db?: Db): Promise<boolean> {
  if (!(await getCurrentAccount())) return false;
  const client = db ?? (await createSupabaseServerClient());
  const { data, error } = await client.rpc("chat_allowed");
  return !error && data === true;
}

// Attaches each message's author (name and campus), read once per page.
export async function withAuthors(db: Db, rows: { id: string; group_id: string; owner_id: string; body: string; created_at: string }[], me: string): Promise<ChatMessage[]> {
  const ids = [...new Set(rows.map((r) => r.owner_id))];
  const people = ids.length ? await db.rpc("chat_people", { people: ids }) : { data: [], error: null };
  const byId = new Map((people.data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    body: r.body,
    createdAt: r.created_at,
    author: byId.get(r.owner_id) ?? { id: r.owner_id, name: "Lawdeck student", campus: null },
    mine: r.owner_id === me,
  }));
}

export type ChatRoom = {
  me: ChatPerson;
  member: boolean;
  groups: ChatGroup[];
  group: ChatGroup;
  messages: ChatMessage[];
  hasOlder: boolean;
};

// One group with the list of groups, unread counts and the latest messages. Null when chat is not
// open to this person or the group does not exist.
export async function getChatRoom(groupKey: string): Promise<ChatRoom | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return null;
  const [groups, unread, member, self] = await Promise.all([
    db.from("chat_groups").select("id, key, name, kind").order("position"),
    db.rpc("chat_unread_counts"),
    db.from("chat_members").select("owner_id").eq("owner_id", account.id).maybeSingle(),
    db.rpc("chat_people", { people: [account.id] }),
  ]);
  if (groups.error) throw new Error("chat read failed");
  const counts = new Map((unread.data ?? []).map((u) => [u.group_id, Number(u.unread)]));
  const list = groups.data.map((g) => ({ ...g, unread: counts.get(g.id) ?? 0 }));
  const group = list.find((g) => g.key === groupKey);
  if (!group) return null;
  const rows = await db
    .from("chat_messages")
    .select("id, group_id, owner_id, body, created_at")
    .eq("group_id", group.id)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (rows.error) throw new Error("chat read failed");
  const page = rows.data.slice(0, PAGE).reverse();
  return {
    me: self.data?.[0] ?? { id: account.id, name: "You", campus: null },
    member: Boolean(member.data),
    groups: list,
    group,
    messages: await withAuthors(db, page, account.id),
    hasOlder: rows.data.length > PAGE,
  };
}

// Where /chat opens: the student's own campus group, else All campuses.
export async function homeGroupKey(): Promise<string> {
  const account = await getCurrentAccount();
  if (!account) return "all-campuses";
  const db = await createSupabaseServerClient();
  const profile = await db.from("profiles").select("campus").eq("id", account.id).maybeSingle();
  return profile.data?.campus ?? "all-campuses";
}

// Messages matching words or a #hashtag across every group, newest first (at most 50).
export async function searchChat(q: string, tag: string | null): Promise<(ChatMessage & { groupKey: string; groupName: string })[] | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return null;
  let query = db.from("chat_messages").select("id, group_id, owner_id, body, created_at").is("hidden_at", null);
  if (tag) query = query.contains("hashtags", [tag]);
  if (q) query = query.ilike("body", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const [rows, groups] = await Promise.all([query.order("created_at", { ascending: false }).limit(50), db.from("chat_groups").select("id, key, name")]);
  if (rows.error || groups.error) throw new Error("chat search failed");
  const byGroup = new Map(groups.data.map((g) => [g.id, g]));
  return (await withAuthors(db, rows.data, account.id)).map((m) => ({ ...m, groupKey: byGroup.get(m.groupId)?.key ?? "", groupName: byGroup.get(m.groupId)?.name ?? "" }));
}
