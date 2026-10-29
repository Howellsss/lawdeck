import { expect, test } from "@playwright/test";

const ANSWER = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

// Browser tests run without Supabase or Azure settings, so every visitor is signed out and the
// voice is not set up.
test("reading aloud refuses visitors and other websites", async ({ request, baseURL }) => {
  const visitor = await request.post("/api/speech", {
    data: { messageId: ANSWER, part: 0 },
    headers: { Origin: baseURL ?? "" },
  });
  expect(visitor.status()).toBe(401);
  expect(await visitor.json()).toEqual({ message: "Sign in to hear answers read aloud." });
  const elsewhere = await request.post("/api/speech", {
    data: { messageId: ANSWER, part: 0 },
    headers: { Origin: "https://example.com" },
  });
  expect(elsewhere.status()).toBe(403);
});

test("the voice test is for reviewers and admins only", async ({ page, request, baseURL }) => {
  const response = await request.post("/api/speech/test", {
    data: { text: "Njemanze" },
    headers: { Origin: baseURL ?? "" },
  });
  expect(response.status()).toBe(404);
  await page.goto("/admin/voice");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voice test" })).toHaveCount(0);
});

test("without the voice set up there is no voice mode button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("What are we working on?")).toBeVisible();
  await expect(page.getByRole("button", { name: /Voice mode/ })).toHaveCount(0);
});

test("hearing a voice sample needs a sign-in and a real voice", async ({ request, baseURL }) => {
  const visitor = await request.post("/api/speech/sample", { data: { voice: "uk-female" }, headers: { Origin: baseURL ?? "" } });
  expect(visitor.status()).toBe(401);
  const elsewhere = await request.post("/api/speech/sample", { data: { voice: "uk-female" }, headers: { Origin: "https://example.com" } });
  expect(elsewhere.status()).toBe(403);
});
