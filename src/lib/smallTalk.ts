// Voice mode (founder, 2026-10-28): "Hey, what's up?" should get a quick friendly reply, not a
// library search. A turn counts as small talk when, once greetings, thanks, pleasantries and
// Lawdeck's name are taken out, nothing (or one stray word) is left. Anything else, including
// "yes, go on", goes through the library as usual.
const PHRASES = [
  "what's up", "whats up", "what is up", "wassup", "sup",
  "how are you doing", "how are you", "how're you", "how you doing", "how is it going", "how's it going",
  "how far", "how you dey", "how body",
  "good morning", "good afternoon", "good evening", "good night",
  "i'm good", "i am good", "i'm fine", "i am fine", "i'm okay", "i'm great", "i'm doing well", "doing well",
  "all good", "not bad", "nice to meet you",
  "thank you so much", "thank you", "thanks a lot", "thanks",
  "see you later", "see you", "talk later", "goodbye", "good bye", "bye bye", "bye",
  "hey there", "hello there", "hi there",
  "law deck", "lawdeck", "lord deck", "lordeck", "lodeck",
  // The voices' names: the student may greet the assistant by the voice they chose ("Hey Ryan").
  "sonia", "ryan", "ava", "andrew", "ezinne", "abeo",
  "hey", "hi", "hello", "yo", "hiya",
  "cool", "nice", "great", "awesome", "alright", "all right", "okay", "ok", "fine", "good",
  "how about you", "what about you", "and you", "you", "too", "man", "bro", "boss", "my friend", "friend", "oh", "so", "well",
];

const pattern = new RegExp(
  `\\b(${PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|")})\\b`,
  "gi",
);

export function isSmallTalk(text: string): boolean {
  const flat = text.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z'\s]/g, " ");
  if (!flat.trim() || flat.trim().split(/\s+/).length > 12) return false;
  const left = flat.replace(pattern, " ").trim().split(/\s+/).filter(Boolean);
  return left.length <= 1 && flat.trim() !== left.join(" ");
}

// Voice mode (founder, 2026-11-08: "I say 'Hey Ryan' and it says 'Hey Howells, what's up'"):
// clear greetings get an instant reply written by Lawdeck itself, with the student's first name,
// so no AI is called and the name never reaches the AI (rule G-06). Anything less clear returns
// null and goes to the voice model as before.
type Kind = "bye" | "thanks" | "bothFine" | "fine" | "howAreYou" | "timeOfDay" | "hello";

const KINDS: [Kind, RegExp][] = [
  ["bye", /\b(bye|goodbye|good bye|see you|talk later|good night)\b/],
  ["thanks", /\b(thank you|thanks)\b/],
  ["bothFine", /\b(i'm|i am) (good|fine|okay|great|doing well)\b.*\b(you|and you)\b/],
  ["fine", /\b((i'm|i am) (good|fine|okay|great|doing well)|doing well|all good|not bad)\b/],
  ["howAreYou", /\b(what's up|whats up|what is up|wassup|sup|how are you|how're you|how you doing|how is it going|how's it going|how far|how you dey|how body)\b/],
  ["timeOfDay", /\bgood (morning|afternoon|evening)\b/],
  ["hello", /\b(hey|hi|hello|hiya|yo)\b/],
];

// Each reply, with and without the student's name; a few wordings so it does not sound canned.
const REPLIES: Record<Kind, ((name: string | null) => string)[]> = {
  bye: [
    (n) => (n ? `Bye ${n}, talk soon!` : "Bye, talk soon!"),
    (n) => (n ? `See you later, ${n}. Good luck with your studies!` : "See you later. Good luck with your studies!"),
  ],
  thanks: [
    (n) => (n ? `Any time, ${n}! What's next?` : "Any time! What's next?"),
    (n) => (n ? `You're welcome, ${n}. Anything else you want to go over?` : "You're welcome. Anything else you want to go over?"),
  ],
  bothFine: [
    (n) => (n ? `I'm good too, thanks for asking, ${n}. What are we studying today?` : "I'm good too, thanks for asking. What are we studying today?"),
  ],
  fine: [
    (n) => (n ? `Glad to hear it, ${n}. What are we studying today?` : "Glad to hear it. What are we studying today?"),
    (n) => (n ? `Nice one, ${n}. What would you like to work on?` : "Nice one. What would you like to work on?"),
  ],
  howAreYou: [
    (n) => (n ? `I'm good, ${n}, how about you?` : "I'm good, how about you?"),
    (n) => (n ? `All good here, ${n}. How are you doing?` : "All good here. How are you doing?"),
  ],
  timeOfDay: [
    (n) => (n ? `Hello ${n}! How are you today?` : "Hello! How are you today?"),
  ],
  hello: [
    (n) => (n ? `Hey ${n}, what's up?` : "Hey, what's up?"),
    (n) => (n ? `Hi ${n}! What's on your mind?` : "Hi! What's on your mind?"),
  ],
};

// The reply to a small-talk turn, or null when the model should answer. `variant` picks a wording.
export function quickReply(text: string, name: string | null, variant = 0): string | null {
  if (!isSmallTalk(text)) return null;
  const flat = text.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z'\s]/g, " ").replace(/\s+/g, " ");
  const kind = KINDS.find(([, test]) => test.test(flat))?.[0];
  if (!kind) return null;
  const options = REPLIES[kind];
  return options[Math.abs(Math.trunc(variant)) % options.length](name);
}

// The first name to greet a student by, from their profile's full name: the first word, letters
// only, at most 30 characters, starting with a capital. Null when there is none.
export function greetingName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^\p{L}'-]/gu, "").slice(0, 30);
  if (!/\p{L}/u.test(clean)) return null;
  return clean.charAt(0).toLocaleUpperCase("en") + clean.slice(1);
}

// Takes the student's name back out of earlier replies before they go to the AI or the search as
// context ("Hey Howells, what's up?" becomes "Hey, what's up?"), so the name never leaves Lawdeck
// that way either (rule G-06).
export function withoutName(text: string, name: string | null): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`,?\\s*(?<![\\p{L}'])${escaped}(?![\\p{L}'])`, "giu"), "")
    .replace(/^\s+/, "");
}
