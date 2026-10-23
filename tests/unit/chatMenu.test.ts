import { describe, expect, it } from "vitest";
import { deleteChatSchema, moveChatSchema, renameChatSchema } from "@/schemas/chats";

const id = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";
const projectId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("chat names", () => {
  it("tidies spaces", () => {
    expect(renameChatSchema.parse({ id, title: "  Service   of  process " }).title).toBe("Service of process");
  });

  it("rejects empty or blank names", () => {
    expect(renameChatSchema.safeParse({ id, title: "" }).success).toBe(false);
    expect(renameChatSchema.safeParse({ id, title: "   " }).success).toBe(false);
  });

  it("allows 200 characters, as the database does, and rejects more", () => {
    expect(renameChatSchema.safeParse({ id, title: "a".repeat(200) }).success).toBe(true);
    expect(renameChatSchema.safeParse({ id, title: "a".repeat(201) }).success).toBe(false);
  });
});

describe("moving a chat", () => {
  it("into a project, or out of one with an empty choice", () => {
    expect(moveChatSchema.parse({ id, projectId }).projectId).toBe(projectId);
    expect(moveChatSchema.parse({ id, projectId: "" }).projectId).toBeNull();
  });

  it("refuses anything that is not a project id", () => {
    expect(moveChatSchema.safeParse({ id, projectId: "1 or 1=1" }).success).toBe(false);
  });
});

describe("chat ids", () => {
  it("must be real ids, so odd addresses never reach the database", () => {
    expect(deleteChatSchema.safeParse({ id }).success).toBe(true);
    expect(deleteChatSchema.safeParse({ id: "../projects" }).success).toBe(false);
    expect(renameChatSchema.safeParse({ id: "", title: "x" }).success).toBe(false);
  });
});
