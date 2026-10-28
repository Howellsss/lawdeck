# Voice: reading answers aloud and voice mode

Founder's request, 2026-10-28: speak to Lawdeck and hear it answer, a **Read** button on every
answer, and clean pronunciation of Nigerian names. Founder chose Microsoft Azure (Nigerian English
voices) and that students choose the voice.

## What students get
- **Read** on every Learn answer: reads the whole answer, with Pause, Resume and Stop.
- **Voice mode** (sound-wave button on the home screen and in a chat): Lawdeck listens, answers on
  screen, reads the **Short answer** aloud, asks "Would you like me to read the full explanation?",
  then listens again. Saying "yes" reads the rest; "stop" or **End** ends voice mode.
- **Reading voice** on the Account page: female (Ezinne, default) or male (Abeo), both Nigerian English.

## How names and legal shorthand are read
- Nigerian English voices say most Nigerian names properly.
- `src/templates/pronunciations.json`: names the voice says wrongly, with a respelling. Found by
  listening on **Admin → Voice test**.
- `src/lib/speech.ts`: "A v. B" is read "A and B"; "State v. A" (and other prosecutors) "State
  against A"; "& Anor/Ors" as "and another/others"; "s. 36" as "section 36"; "O. 13 r. 4" as
  "Order 13 rule 4"; "(Pt. 712)" as "part 712"; NWLR, CFRN, SC and similar spelt out.

## Safety and cost
- Only answer text is sent to Azure, from the server (`src/server/ai/speech.ts`). Students can only
  hear their own saved answers: the server loads the answer under row-level security; no free text
  from a student's browser reaches the voice service. The test page (free text) is staff only.
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
