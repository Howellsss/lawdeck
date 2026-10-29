import { z } from "@/lib/zod";

// Reading answers aloud (founder, 2026-10-28). Students choose the voice: British, American or
// Nigerian English, female or male (founder, 2026-10-29: "a balanced English accent that
// pronounces clear"). British female by default.
export const VOICES = ["uk-female", "uk-male", "us-female", "us-male", "ng-female", "ng-male"] as const;
export type Voice = (typeof VOICES)[number];
export const DEFAULT_VOICE: Voice = "uk-female";

export const VOICE_LABELS: Record<Voice, string> = {
  "uk-female": "British English, female (Sonia)",
  "uk-male": "British English, male (Ryan)",
  "us-female": "American English, female (Ava)",
  "us-male": "American English, male (Andrew)",
  "ng-female": "Nigerian English, female (Ezinne)",
  "ng-male": "Nigerian English, male (Abeo)",
};

// Shorter names for the small voice menus in voice mode and beside Read.
export const VOICE_SHORT_LABELS: Record<Voice, string> = {
  "uk-female": "Sonia (British)",
  "uk-male": "Ryan (British)",
  "us-female": "Ava (American)",
  "us-male": "Andrew (American)",
  "ng-female": "Ezinne (Nigerian)",
  "ng-male": "Abeo (Nigerian)",
};

// What to read: the whole answer, only its "Short answer" (voice conversations), or the rest
// after the short answer (when the student says "yes, read the rest").
export const SPEECH_SCOPES = ["full", "short", "rest"] as const;
export type SpeechScope = (typeof SPEECH_SCOPES)[number];

// The server reads the saved answer itself, so students can only hear their own answers; no
// free text is ever sent from a student's browser to the voice service.
export const speechRequestSchema = z.object({
  messageId: z.uuid({ error: "That answer could not be found." }),
  part: z.number().int().min(0).max(199),
  scope: z.enum(SPEECH_SCOPES).default("full"),
  voice: z.enum(VOICES).default(DEFAULT_VOICE),
});

// "Hear this voice" on the Account page: only this fixed sentence is ever read for it.
export const VOICE_SAMPLE_TEXT =
  "Hello! I'm Lawdeck. I'll read your answers in this voice, and we can talk through any topic together.";
export const voiceSampleSchema = z.object({ voice: z.enum(VOICES) });

// Staff only: the voice test page reads any short text, to check how names sound.
export const VOICE_TEST_MAX_CHARS = 600;
export const voiceTestSchema = z.object({
  text: z
    .string({ error: "Type something to hear." })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { error: "Type something to hear." }).max(VOICE_TEST_MAX_CHARS, { error: `Up to ${VOICE_TEST_MAX_CHARS} characters.` })),
  voice: z.enum(VOICES).default(DEFAULT_VOICE),
});

// The pronunciation list (src/templates/pronunciations.json): how to say names the voice gets
// wrong. "say" is a respelling the voice reads instead of the written name; the screen always
// shows the name as written.
export const pronunciationFileSchema = z.object({
  note: z.string(),
  names: z.array(
    z.object({
      name: z.string().min(2).max(60).regex(/^[\p{L}][\p{L}' -]*$/u, { error: "Letters, spaces, hyphens and apostrophes only." }),
      say: z.string().min(2).max(80).regex(/^[\p{L} '-]+$/u, { error: "Letters, spaces, hyphens and apostrophes only." }),
    }),
  ),
});
