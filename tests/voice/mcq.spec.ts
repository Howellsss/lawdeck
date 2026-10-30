import { expect, test } from "@playwright/test";

// Founder, 2026-10-30: practice is now "MCQ", and pressing a button must show at once that it is
// working ("Creating questions…" with a spinner, as drafting does). The server is slowed here so
// the working state can be seen; as a visitor it then refuses ("Sign in").
test("MCQ beside Explain, and Create questions shows it is working", async ({ page }) => {
  await page.route("**/test-pages/mcq", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/test-pages/mcq");
  await expect(page.getByRole("button", { name: "Explain Wombat procedure" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Practise Wombat procedure" })).toHaveCount(0);

  const create = page.getByRole("button", { name: "Create questions" });
  await create.click();
  await expect(page.getByRole("button", { name: "Creating questions…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Writing your questions");
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await expect(create).toBeEnabled();
});

test("the MCQ button shows it is opening the topic", async ({ page }) => {
  await page.route("**/practice/new**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/test-pages/mcq");
  await page.getByRole("button", { name: "MCQ on Wombat procedure" }).click();
  await expect(page.getByRole("button", { name: "Opening… on Wombat procedure" })).toBeVisible();
});
