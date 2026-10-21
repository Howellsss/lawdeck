import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { failureDetails } from "@/server/ai/client";

describe("failureDetails", () => {
  it("keeps the status, type and Claude's short reason for the log", () => {
    const body = { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low." } };
    const error = Anthropic.APIError.generate(400, body, undefined, new Headers({ "request-id": "req_1" }));
    expect(failureDetails(error)).toEqual({
      name: "BadRequestError",
      status: 400,
      type: "invalid_request_error",
      reason: "Your credit balance is too low.",
      requestId: "req_1",
    });
  });

  it("cuts long reasons short", () => {
    const body = { error: { type: "invalid_request_error", message: "x".repeat(500) } };
    const details = failureDetails(Anthropic.APIError.generate(400, body, undefined, new Headers()));
    expect(String(details.reason)).toHaveLength(160);
  });

  it("only names errors that did not come from Claude", () => {
    expect(failureDetails(new TypeError("boom"))).toEqual({ name: "TypeError" });
  });
});
