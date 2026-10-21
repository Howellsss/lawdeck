import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { TRANSCRIBE_PROMPT_VERSION, TRANSCRIBE_SYSTEM, transcribeRequest } from "@/prompts/transcribe";
import { failureDetails, getClaude } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// Claude's request limit is 32 MB; base64 makes a file a third bigger.
export const SCAN_MAX_BASE64_CHARS = 30_000_000;

export type ScanSource =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: "image/png" | "image/jpeg" };

export type TranscribeResult =
  // complete: false when the reply was cut off, so pages it did not reach are read again later.
  | { ok: true; pages: Map<number, string>; complete: boolean }
  | { ok: false; reason: "too_large" | "refused" | "unavailable" | "unreadable" };

// Reads the text of scanned pages (a PDF's pages, or one photo as page 1) with Claude.
// The file is marked for caching, so reading a long scan in batches does not pay for it each time.
// Callers keep batches small (a few pages) so each call ends well inside the 60-second limit (rule G-10).
export async function transcribePages(
  source: ScanSource,
  pageFrom: number,
  pageTo: number,
  userId: string,
): Promise<TranscribeResult> {
  if (source.base64.length > SCAN_MAX_BASE64_CHARS) return { ok: false, reason: "too_large" };
  const file: Anthropic.ContentBlockParam =
    source.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: source.base64 },
          cache_control: { type: "ephemeral" },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: source.mediaType, data: source.base64 },
          cache_control: { type: "ephemeral" },
        };

  const started = Date.now();
  try {
    const response = await getClaude().messages.create({
      model: MODELS.transcribe,
      max_tokens: 16_000,
      thinking: { type: "disabled" },
      system: TRANSCRIBE_SYSTEM,
      messages: [{ role: "user", content: [file, { type: "text", text: transcribeRequest(pageFrom, pageTo) }] }],
    });
    // Rule G-08: model, tokens, cost and time per call, with the user and feature. Never the text.
    console.info("ai call", {
      job: "transcribe",
      userId,
      prompt: TRANSCRIBE_PROMPT_VERSION,
      model: response.model,
      pages: pageTo - pageFrom + 1,
      tokensIn: response.usage.input_tokens,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      tokensOut: response.usage.output_tokens,
      costUsd: costUsd(response.model, response.usage),
      ms: Date.now() - started,
      stop: response.stop_reason,
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const pages = parseTranscript(text, pageFrom, pageTo);
    if (response.stop_reason !== "max_tokens") return { ok: true, pages, complete: true };
    // Cut off by the length limit: the last page may be incomplete, so it is read again next time.
    pages.delete(Math.max(...pages.keys()));
    return pages.size > 0 ? { ok: true, pages, complete: false } : { ok: false, reason: "unreadable" };
  } catch (error) {
    console.error("ai call failed", { job: "transcribe", userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof Anthropic.BadRequestError) return { ok: false, reason: "unreadable" };
    return { ok: false, reason: "unavailable" };
  }
}

// Splits Claude's reply into pages by its "=== Page N ===" markers. Only the pages asked for
// are kept. A reply with no markers for a single page is taken as that page.
export function parseTranscript(text: string, pageFrom: number, pageTo: number): Map<number, string> {
  const pages = new Map<number, string>();
  const markers = [...text.matchAll(/^\s*=+\s*Page\s+(\d+)\s*=+\s*$/gim)];
  if (markers.length === 0) {
    if (pageFrom === pageTo && text.trim()) pages.set(pageFrom, text.trim());
    return pages;
  }
  markers.forEach((marker, index) => {
    const page = Number(marker[1]);
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? text.length;
    if (page >= pageFrom && page <= pageTo && !pages.has(page)) pages.set(page, text.slice(start, end).trim());
  });
  return pages;
}
