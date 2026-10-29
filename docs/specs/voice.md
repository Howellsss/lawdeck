# Voice: reading answers aloud and voice mode

Founder's request, 2026-10-28: speak to Lawdeck and hear it answer, a **Read** button on every
answer, and clean pronunciation of Nigerian names. Founder chose Microsoft Azure (Nigerian English
voices) and that students choose the voice.

## What students get
- **Read** on every Learn answer: reads the whole answer, with Pause, Resume and Stop.
- **Voice mode** (sound-wave button on the home screen and in a chat), like ChatGPT's voice mode
  (founder, 2026-10-28: "you press it, say something, it responds immediately there; it doesn't
  leave"): a full-screen voice view opens on the same page, with a circle that breathes while
  listening, pulses while thinking and shows a wave while speaking, with the Lawdeck mark inside, and an End button. Lawdeck
  listens until the student pauses (1.1 seconds), and speaks its reply sentence by sentence as it
  is written: the answer route sends each spoken sentence (MP3) with the text
  (`src/server/learn/liveSpeech.ts`); the first long clause may be spoken before its sentence ends, and the reply's speech is recorded once at the end, so the first words play within a second or two. Small talk is answered by the fastest model (`MODELS.smallTalk`, Haiku); teaching replies use the explanations model. Nothing is
  written out on screen while talking; tapping the circle interrupts. Small talk skips the library
  (`src/lib/smallTalk.ts`); "yes, go on" is searched with the recent conversation
  (`src/lib/talkSearch.ts`). Silence never ends it; End (or saying goodbye) does. The conversation
  is saved as a chat (from the home screen, a new chat is made from the first thing said) with
  "Read the conversation" afterwards. Teaching replies count as questions; small talk is free
  (`talk_chat`, migration 40). Lawdeck talks to the student as "you": student names are never
  sent to the AI.
- **Reading voice** on the Account page, with "Hear this voice" (a fixed sample sentence): British
  English female (Sonia, default) or male (Ryan), American English female (Ava) or male (Andrew),
  Nigerian English female (Ezinne) or male (Abeo) (founder, 2026-10-29: "a balanced English accent
  that pronounces clear"; Azure has only these two Nigerian English voices).

## How names and legal shorthand are read
- Nigerian English voices say most Nigerian names properly.
- `src/templates/pronunciations.json`: names the voice says wrongly, with a respelling. Found by
  listening on **Admin → Voice test**.
- `src/lib/speech.ts`: "A v. B" is read "A and B"; "State v. A" (and other prosecutors) "State
  against A"; "& Anor/Ors" as "and another/others"; "s. 36" as "section 36"; "O. 13 r. 4" as
  "Order 13 rule 4"; "(Pt. 712)" as "part 712"; NWLR, CFRN, SC and similar spelt out.

## Speed
- The server runs in Vercel's Dublin region (`vercel.json`), beside Supabase (Ireland) and Azure North
  Europe (Ireland), so the database and voice calls in each turn stay within the region.

## Safety and cost
- Only Lawdeck's own answer text is sent to Azure, from the server (`src/server/ai/speech.ts`): Read
  loads the student's saved answer under row-level security; voice mode speaks the reply as it is
  written, after the citation check. No free text from a student's browser reaches the voice service. The test page (free text) is staff only.
- Each part is logged in `usage_events` as kind `speech` (voice, characters, cost, time), never the
  text. Speech never counts towards the monthly question allowance (migration 38).
- Daily limit: 40,000 characters a student (about ten long answers), Lagos time; staff unlimited.
- Cost: about US$16 per million characters after Azure's free 500,000 a month (about 2 US cents for
  a short answer, 5–7 cents for a long answer read in full).

## Setting it up (founder)
1. https://portal.azure.com → create a free account (Microsoft asks for a card to check identity).
2. Search **Speech service** → **Create**. Resource group: new, `lawdeck`. Region: **West Europe**.
   Name: `lawdeck-speech`. Pricing tier: **Free F0**. **Review + create** → **Create**.
3. Open the new resource → **Keys and Endpoint**. Copy **KEY 1**; the **Location/Region** is `westeurope`.
4. Vercel → lawdeck → **Settings → Environment Variables**: add `AZURE_SPEECH_KEY` (KEY 1) and
   `AZURE_SPEECH_REGION` (`westeurope`), for Production and Preview.
5. Vercel → **Deployments** → latest → **⋯ → Redeploy**. Until then the buttons stay hidden.
6. Supabase → SQL editor: paste `supabase/migrations/20261028003800_speech.sql` and run it.

The free tier allows a limited number of requests a minute; move to **Standard S0** in Azure
(Pricing tier) when many students use voice at once.
