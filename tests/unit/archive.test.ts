import { describe, expect, it } from "vitest";
import { archivePath, sha256Hex } from "@/server/library/archive";

describe("archive of original library files", () => {
  it("stores each file under its course, item and content fingerprint", () => {
    expect(archivePath("course", "item", "abc123", "pdf")).toBe("course/item/abc123.pdf");
    expect(archivePath("course", "item", "abc123", "jpeg")).toBe("course/item/abc123.jpg");
  });

  it("gives the same file the same fingerprint, and a changed file a new one", () => {
    const a = sha256Hex(new TextEncoder().encode("original"));
    expect(a).toBe(sha256Hex(new TextEncoder().encode("original")));
    expect(a).not.toBe(sha256Hex(new TextEncoder().encode("changed")));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
