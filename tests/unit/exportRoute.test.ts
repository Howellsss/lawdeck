import { beforeEach, describe, expect, it, vi } from "vitest";

// The Word download route with a pretend sign-in and loader: nothing real is touched.
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const account = vi.fn();
const loadSheet = vi.fn();
const recordDownload = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/exports/load", () => ({ loadSheet, exportFileName: (t: string) => t }));
vi.mock("@/server/monitoring/downloads", () => ({ recordDownload }));
const { GET } = await import("@/app/api/exports/[kind]/[id]/route");

const call = (kind: string, id: string, query = "") =>
  GET(new Request(`https://lawdeck.test/api/exports/${kind}/${id}${query}`), { params: Promise.resolve({ kind, id }) } as never);

beforeEach(() => {
  account.mockReset().mockResolvedValue({ id: "me" });
  recordDownload.mockReset();
  loadSheet.mockReset().mockResolvedValue({ status: "ok", data: { title: "Notes", subtitle: "s", blocks: [] } });
});

describe("downloading a study sheet", () => {
  it("asks visitors to sign in and loads nothing", async () => {
    account.mockResolvedValue(null);
    expect((await call("chat", ID)).status).toBe(401);
    expect(loadSheet).not.toHaveBeenCalled();
    expect(recordDownload).not.toHaveBeenCalled();
  });

  it("refuses unknown kinds and malformed ids before reading anything", async () => {
    expect((await call("uploads", ID)).status).toBe(404);
    expect((await call("chat", "not-an-id")).status).toBe(404);
    expect(loadSheet).not.toHaveBeenCalled();
  });

  it("says not found for someone else's work (row-level security returns nothing)", async () => {
    loadSheet.mockResolvedValue({ status: "ok", data: null });
    expect((await call("brief", ID)).status).toBe(404);
  });

  it("sends the student's own work as a private Word file", async () => {
    const response = await call("practice", ID, "?notKnown=1");
    expect(response.status).toBe(200);
    // Each export is counted for the hourly unusual-access check (step 7e).
    expect(recordDownload).toHaveBeenCalledWith("study_export");
    expect(loadSheet).toHaveBeenCalledWith({ kind: "practice", id: ID, notKnown: true });
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Notes.docx"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
