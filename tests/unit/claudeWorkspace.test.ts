import { describe, expect, it, vi } from "vitest";
import { workspaceHeaders } from "@/server/ai/client";

describe("workspaceHeaders", () => {
  it("sends the workspace ID when one is set", () => {
    expect(workspaceHeaders("wrkspc_0128BwXP23kGYCu9QkS6AJ1H")).toEqual({
      "anthropic-workspace-id": "wrkspc_0128BwXP23kGYCu9QkS6AJ1H",
    });
    expect(workspaceHeaders("  wrkspc_0128BwXP23kGYCu9QkS6AJ1H\n")).toEqual({
      "anthropic-workspace-id": "wrkspc_0128BwXP23kGYCu9QkS6AJ1H",
    });
  });

  it("sends nothing when no workspace is set (workspace keys don't need it)", () => {
    expect(workspaceHeaders(undefined)).toEqual({});
    expect(workspaceHeaders("")).toEqual({});
  });

  it("ignores anything that is not a workspace ID", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(workspaceHeaders("sk-ant-usr-abc")).toEqual({});
    expect(workspaceHeaders("wrkspc_abc123defg\r\nx-other: 1")).toEqual({});
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
