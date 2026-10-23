import { INVITE_ALPHABET } from "@/schemas/pilot";

// A new invite code: 10 characters chosen at random (secure random numbers, no bias).
export function generateInviteCode(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const limit = 256 - (256 % INVITE_ALPHABET.length);
  let code = "";
  while (code.length < 10) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < limit && code.length < 10) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    }
  }
  return code;
}
