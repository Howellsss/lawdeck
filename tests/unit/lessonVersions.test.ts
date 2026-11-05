import { describe, expect, it } from "vitest";
import { approvedBehind, currentVersion } from "@/lib/lessonVersions";

const row = (id: string, status: string, replaced_by: string | null = null) => ({ id, status, replaced_by });

describe("lesson versions", () => {
  it("works on the newer version while the approved one stays with students", () => {
    const rows = [row("v1", "approved"), row("v2", "pending")];
    expect(currentVersion(rows)?.id).toBe("v2");
    expect(approvedBehind(rows)?.id).toBe("v1");
  });
  it("uses the approved version when nothing newer exists", () => {
    const rows = [row("v1", "withdrawn", "v2"), row("v2", "approved")];
    expect(currentVersion(rows)?.id).toBe("v2");
    expect(approvedBehind(rows)).toBeNull();
  });
  it("ignores replaced versions", () => expect(currentVersion([row("v1", "withdrawn", "v2")])).toBeNull());
});
