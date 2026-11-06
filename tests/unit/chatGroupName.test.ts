import { describe, expect, it } from "vitest";
import { welcomeName } from "@/lib/chatGroupName";

describe("chat group welcome", () => {
  it("greets a campus group as its NLS campus", () => {
    expect(welcomeName("campus", "Abuja")).toBe("NLS Abuja Campus");
    expect(welcomeName("campus", "Port Harcourt")).toBe("NLS Port Harcourt Campus");
  });
  it("keeps other groups' own names", () => {
    expect(welcomeName("all", "All campuses")).toBe("All campuses");
    expect(welcomeName("aspirants", "Aspirants")).toBe("Aspirants");
    expect(welcomeName("study", "Civil Lit squad")).toBe("Civil Lit squad");
  });
});
