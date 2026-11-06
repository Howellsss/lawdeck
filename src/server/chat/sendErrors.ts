import "server-only";

// What a student sees when the database turns a message down (the word filter, the contact-details
// check, voice-note rules, the posting limit, lesson cards). Never shows the message text.
export function sendErrorMessage(error: { code?: string; message: string }): string | null {
  if (error.message.includes("blocked_word")) {
    return "Your message wasn’t sent: it contains a word that isn’t allowed in Lawdeck chat. Please reword it.";
  }
  if (error.message.includes("contact_details")) {
    return "Your message wasn’t sent: phone numbers, email addresses and WhatsApp or social links aren’t allowed in Lawdeck chat, to keep everyone safe.";
  }
  if (error.message.includes("voice_note")) return "Voice notes can be sent in study groups only, up to 2 minutes.";
  if (error.message.includes("post_limit")) return "You’re sending messages very quickly. Please wait a minute, then try again.";
  if (error.message.includes("lesson_not_shareable")) return "That lesson can’t be shared right now: it is waiting for a reviewer. Please pick another topic.";
  if (error.message.includes("note_too_long")) return "A note can be up to 500 characters.";
  if (error.message.includes("poll_invalid")) return "A poll needs a question (up to 200 characters) and 2 to 6 different choices (up to 80 characters each).";
  if (error.message.includes("poll_names")) return "Names can be shown on polls in study groups only.";
  if (error.code === "42501") return "Please accept the community rules before posting.";
  return null;
}
