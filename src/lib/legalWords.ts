// Voice mode (founder, 2026-11-17: "I tell it mortgage it hears mod gauge"): the browser's speech
// recognition knows everyday English, not law, so law words come back misheard. Lawdeck corrects
// what it heard against its own words: the names of its courses, topics and reviewed library
// books (loaded from the database; no legal content lives in this file). Words are compared by
// how they sound, so "mod gauge" finds "mortgage" and "wheels and codesels" finds "wills and
// codicils".

// Words that never start or end a phrase to be corrected.
const SMALL_WORDS = new Set(
  "a an and as at be by for from in into is it of on or the to under with".split(" "),
);
// A shorter sound than this is too common to correct safely ("lent" and "land").
const MIN_SOUND = 5;
// Near matches (one or two sounds off) only for longer phrases, about one difference per six sounds.
const NEAR_MIN_SOUND = 8;
const SOUNDS_PER_DIFFERENCE = 6;
const MAX_PHRASE_WORDS = 4;
// Spoken turns are short; a very long one is left as heard, so correcting never slows a reply.
const MAX_CORRECTED_WORDS = 120;

export type Vocabulary = {
  // Sound → the phrase as Lawdeck's library writes it (lower case).
  bySound: Map<string, string>;
  // Every word that appears in the names, lower case.
  words: Set<string>;
  // All sounds, for near matches.
  sounds: string[];
};

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

// A rough sound of one word, the way it is heard in Nigerian and British English: letters that
// sound alike become one, vowels are not told apart, an "r" before a consonant is silent, and
// voiced and unvoiced pairs (d/t, b/p, g/k, v/f) are treated as the same.
export function wordSound(word: string): string {
  let w = clean(word);
  if (!w) return "";
  w = w
    .replace(/^wh/, "w")
    .replace(/^kn/, "n")
    .replace(/^wr/, "r")
    .replace(/^ps/, "s")
    .replace(/ph/g, "f")
    .replace(/gh/g, "")
    .replace(/t?ch/g, "J")
    .replace(/sh/g, "S")
    .replace(/dg/g, "J")
    .replace(/ck/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/g(?=[eiy])/g, "J")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/r(?![aeiouy])/g, "")
    .replace(/d/g, "t")
    .replace(/b/g, "p")
    .replace(/v/g, "f")
    .replace(/g/g, "k")
    .replace(/j/g, "J");
  w = w[0] + w.slice(1).replace(/h/g, "");
  w = w.replace(/[aeiouy]+/g, "a").replace(/(.)\1+/g, "$1");
  return w.length > 1 ? w.replace(/a$/, "") : w;
}

export function phraseSound(words: string[]): string {
  return words.map(wordSound).join("");
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// The phrases Lawdeck listens for: every name, and each run of up to four words inside it (with
// the singular too: "mortgages" also gives "mortgage").
export function buildVocabulary(names: string[]): Vocabulary {
  const bySound = new Map<string, string>();
  const words = new Set<string>();
  const add = (phrase: string[]) => {
    if (phrase.length === 0 || SMALL_WORDS.has(phrase[0]) || SMALL_WORDS.has(phrase[phrase.length - 1])) return;
    const sound = phraseSound(phrase);
    if (sound.length >= MIN_SOUND && !bySound.has(sound)) bySound.set(sound, phrase.join(" "));
  };
  for (const name of names) {
    const tokens = name.split(/[\s/–-]+/).map(clean).filter(Boolean);
    for (const token of tokens) words.add(token);
    for (let start = 0; start < tokens.length; start++)
      for (let size = 1; size <= MAX_PHRASE_WORDS && start + size <= tokens.length; size++) {
        const phrase = tokens.slice(start, start + size);
        add(phrase);
        const last = singular(phrase[phrase.length - 1]);
        if (last !== phrase[phrase.length - 1]) {
          words.add(last);
          add([...phrase.slice(0, -1), last]);
        }
      }
  }
  return { bySound, words, sounds: [...bySound.keys()] };
}

function differences(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

// A near match must have as many words as what was heard, so nothing heard is ever dropped.
function match(sound: string, wordCount: number, vocabulary: Vocabulary): string | null {
  const exact = vocabulary.bySound.get(sound);
  if (exact) return exact;
  if (sound.length < NEAR_MIN_SOUND) return null;
  const allowed = Math.floor(sound.length / SOUNDS_PER_DIFFERENCE);
  let found: string | null = null;
  let fewest = allowed + 1;
  for (const candidate of vocabulary.sounds) {
    if (candidate[0] !== sound[0] || candidate.length < NEAR_MIN_SOUND) continue;
    const phrase = vocabulary.bySound.get(candidate) ?? "";
    if (phrase.split(" ").length !== wordCount) continue;
    const count = differences(sound, candidate, allowed);
    if (count < fewest) {
      fewest = count;
      found = phrase;
    }
  }
  return found;
}

// Replaces misheard law words with the library's own. Words Lawdeck already knows are left as
// they are, so a correct "private practice" is never changed when the library uses those words.
export function correctHeard(text: string, vocabulary: Vocabulary): string {
  if (vocabulary.bySound.size === 0) return text;
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > MAX_CORRECTED_WORDS) return text;
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let replaced = false;
    for (let size = Math.min(MAX_PHRASE_WORDS, tokens.length - i); size >= 1; size--) {
      const span = tokens.slice(i, i + size);
      const words = span.map(clean);
      if (words.some((word) => !word) || SMALL_WORDS.has(words[0]) || SMALL_WORDS.has(words[size - 1])) continue;
      if (words.every((word) => vocabulary.words.has(word) || SMALL_WORDS.has(word))) continue;
      const sound = phraseSound(words);
      if (sound.length < MIN_SOUND) continue;
      const phrase = match(sound, size, vocabulary);
      if (!phrase || phrase === words.join(" ")) continue;
      const ending = span[size - 1].match(/[^A-Za-z]+$/)?.[0] ?? "";
      out.push(`${phrase}${ending}`);
      i += size;
      replaced = true;
      break;
    }
    if (!replaced) out.push(tokens[i++]);
  }
  return out.join(" ");
}

// How many of Lawdeck's own words a transcript contains.
function knownWords(text: string, vocabulary: Vocabulary): number {
  return text
    .split(/\s+/)
    .map(clean)
    .filter((word) => word.length >= 4 && !SMALL_WORDS.has(word) && vocabulary.words.has(word)).length;
}

// The browser offers up to five guesses of what was said. The one with the most of Lawdeck's own
// words wins (the first guess on a tie), and is then corrected.
export function bestHeard(first: string, others: string[], vocabulary: Vocabulary): string {
  let best = first;
  let bestScore = knownWords(first, vocabulary);
  for (const other of others) {
    const score = knownWords(other, vocabulary);
    if (score > bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return correctHeard(best, vocabulary);
}

// Whether the words name something in Lawdeck's library (a new topic, not "yes, go on").
export function namesLibraryTopic(text: string, vocabulary: Vocabulary): boolean {
  return text
    .split(/\s+/)
    .map(clean)
    .some((word) => word.length >= MIN_SOUND && !SMALL_WORDS.has(word) && vocabulary.words.has(word));
}
