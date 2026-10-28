import { z } from "@/lib/zod";

// Reading answers aloud (founder, 2026-10-28). Students choose the voice; female by default.
export const VOICES = ["female", "male"] as const;
export type Voice = (typeof VOICES)[number];
export const DEFAULT_VOICE: Voice = "female";

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
