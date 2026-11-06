// Lawdeck's own quiz music and sound effects (founder, 2026-11-06): original tunes written as notes
// and played by the browser's Web Audio, so there are no music files and no library. Kahoot's music
// is not used (it belongs to Kahoot). Phones only allow sound after a tap, so `unlock()` is called
// from a tap; everything is quiet until then.

type Mode = "lobby" | "question" | "hurry" | null;
// Overall loudness (founder, 2026-11-06: still too quiet at 0.45). Notes are held and louder, and a
// limiter (compressor) keeps the loud parts from crackling on phone speakers.
const MUSIC_VOLUME = 1;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Four-bar loops: chord roots (MIDI) and whether each chord is minor.
const LOBBY = [
  { root: 48, minor: false }, // C
  { root: 45, minor: true }, // A minor
  { root: 41, minor: false }, // F
  { root: 43, minor: false }, // G
];
const QUESTION = [
  { root: 45, minor: true }, // A minor
  { root: 41, minor: false }, // F
  { root: 48, minor: false }, // C
  { root: 40, minor: false }, // E (major, for tension)
];
// Which chord tone each eighth note plays (0 root, 1 third, 2 fifth, 3 octave).
const ARP = [0, 1, 2, 3, 2, 1, 0, 2];

export class QuizSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mode: Mode = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private muted = false;

  // Call from a tap: creates or wakes the audio (phones refuse sound before a tap).
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MUSIC_VOLUME;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 10;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready() {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, this.ctx.currentTime, 0.05);
  }

  // Background music: lobby or question (other chords, same pace and rhythm); null stops it.
  music(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (!mode) {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      return;
    }
    if (!this.ctx) return;
    if (this.timer === null) {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.05;
      this.timer = window.setInterval(() => this.schedule(), 50);
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.mode) return;
    const bpm = musicTempo(this.mode);
    const eighth = 60 / bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const bars = this.mode === "lobby" ? LOBBY : QUESTION;
      const chord = bars[Math.floor(this.step / 8) % bars.length];
      const tones = [0, chord.minor ? 3 : 4, 7, 12];
      const beat = this.step % 8;
      // Melody: an arpeggio an octave and a half up.
      this.note(hz(chord.root + 24 + tones[ARP[beat]]), this.nextTime, eighth * 0.95, "triangle", 0.9);
      // Bass on beats 1 and 3, the same in the lobby and during questions, so the pace never changes
      // (founder, 2026-11-06: the music sped up when the game started).
      if (beat % 4 === 0) this.note(hz(chord.root - 12 + (beat === 4 ? 7 : 0)), this.nextTime, eighth * 3, "square", 0.35);
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  private note(freq: number, at: number, length: number, type: OscillatorType, level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    // Rise quickly, hold most of the note, then fade (a note that fades at once sounds quiet).
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
    gain.gain.setValueAtTime(level, at + length * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }


  private play(notes: [number, number, number][], type: OscillatorType = "triangle", level = 0.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    for (const [midi, start, length] of notes) this.note(hz(midi), now + start, length, type, level);
  }

  // A rising chime for a right answer.
  correct() {
    this.play([
      [72, 0, 0.12],
      [76, 0.08, 0.12],
      [79, 0.16, 0.12],
      [84, 0.24, 0.35],
    ]);
  }

  // A soft falling tone for a wrong answer.
  wrong() {
    this.play(
      [
        [55, 0, 0.18],
        [50, 0.16, 0.35],
      ],
      "square",
      0.25,
    );
  }

  // One beep per "3, 2, 1"; a higher one when the question opens.
  countdown(last: boolean) {
    this.play([[last ? 84 : 76, 0, 0.12]], "sine", 0.5);
  }

  // The final leaderboard.
  fanfare() {
    this.play([
      [67, 0, 0.16],
      [72, 0.14, 0.16],
      [76, 0.28, 0.16],
      [79, 0.42, 0.6],
      [84, 0.42, 0.6],
    ]);
  }

  close() {
    this.music(null);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

// What should be heard for a quiz moment (pure, so it can be tested).
// Beats a minute: one steady pace in the lobby, during questions and in the last seconds (founder,
// 2026-11-06: speeding up caused panic).
export function musicTempo(mode: Exclude<Mode, null>): number {
  void mode;
  return 112;
}

export function musicFor(status: "lobby" | "live" | "done", readyIn: number, closed: boolean, secondsLeft: number): Mode {
  if (status === "lobby") return "lobby";
  if (status === "done" || readyIn > 0 || closed) return null;
  return secondsLeft <= 5 ? "hurry" : "question";
}
