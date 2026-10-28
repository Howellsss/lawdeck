// Splits text that is still arriving into finished sentences (voice mode speaks each sentence as
// soon as it is complete, rather than waiting for the whole reply). A sentence ends at ".", "!"
// or "?" followed by a space, or at a line break; legal abbreviations such as "s.", "v." or
// "Ltd." do not end one.
const ABBREVIATION = /\b(?:s|ss|o|r|rr|pt|no|v|vs|e\.g|i\.e|ltd|nig|co|mr|mrs|ms|dr|prof|art|arts|para|paras|cf|etc|hon|sec|ch|vol)\.$/i;

export class SentenceSplitter {
  private pending = "";

  // Adds a piece of text and returns the sentences it completed.
  push(text: string): string[] {
    this.pending += text;
    const done: string[] = [];
    let start = 0;
    const ends = /[.!?]+(?=\s)|\n/g;
    for (let match = ends.exec(this.pending); match; match = ends.exec(this.pending)) {
      const cut = match.index + match[0].length;
      const sentence = this.pending.slice(start, cut);
      if (match[0] === "." && ABBREVIATION.test(sentence.trimEnd())) continue;
      if (sentence.trim()) done.push(sentence.trim());
      start = cut;
    }
    this.pending = this.pending.slice(start);
    return done;
  }

  // The rest, once the text has finished arriving.
  end(): string[] {
    const rest = this.pending.trim();
    this.pending = "";
    return rest ? [rest] : [];
  }
}
