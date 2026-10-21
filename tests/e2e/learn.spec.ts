import { expect, test } from "@playwright/test";

const CHAT = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

// Browser tests run without Supabase settings, so every visitor is signed out.
test("the answer route refuses visitors", async ({ request, baseURL }) => {
  const response = await request.post(`/api/chats/${CHAT}/answer`, {
    data: { question: "How is a claim started?" },
    headers: { Origin: baseURL ?? "" },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ message: "Sign in to ask Lawdeck a question." });
});

test("the answer route refuses requests from other websites", async ({ request }) => {
  const response = await request.post(`/api/chats/${CHAT}/answer`, {
    data: { question: "How is a claim started?" },
    headers: { Origin: "https://example.com" },
  });
  expect(response.status()).toBe(403);
  const noOrigin = await request.post(`/api/chats/${CHAT}/answer`, { data: { question: "Why?" } });
  expect(noOrigin.status()).toBe(403);
});

test("asking from the home screen asks visitors to sign in", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("What are we working on?").fill("How is a claim started?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sign in to ask Lawdeck a question.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
});

test("Draft mode says drafting comes later", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Mode", { exact: true }).selectOption("Draft");
  await page.getByLabel("What are we working on?").fill("Draft a writ");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Drafting documents arrives in a later build/)).toBeVisible();
});

test("course hubs never show topics or the topics editor to visitors", async ({ page }) => {
  await page.goto("/courses/civil-litigation");
  await expect(page.getByRole("heading", { name: "Manage topics" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Explain/ })).toHaveCount(0);
});

