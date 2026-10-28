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
  "hey", "hi", "hello", "yo", "hiya",
  "cool", "nice", "great", "awesome", "alright", "all right", "okay", "ok", "fine", "good",
  "and you", "you", "too", "man", "bro", "boss", "my friend", "friend", "oh", "so", "well",
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
