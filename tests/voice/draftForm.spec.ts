import { expect, test } from "@playwright/test";

// The drafting form keeps the student's answers when a draft cannot be made (founder,
// 2026-10-29: "the create draft button does not work after adding all the information").
// Here the server refuses because nobody is signed in; any refusal must leave the answers.
test("a refused draft keeps every answer and says why beside the button", async ({ page }) => {
  await page.goto("/test-pages/draft?t=writ-of-summons");
  await page.getByLabel("High Court of the Federal Capital Territory").check();
  await page.locator("#fact-division").fill("Ikeja Judicial Division");
  await page.locator("#fact-claimantAddress").fill("12 Wombat Close, Ikeja");
  await page.getByRole("button", { name: "Draft the document" }).click();

  await expect(page.locator("form").getByRole("alert")).toContainText("Sign in to draft documents.");
  await expect(page.locator("#fact-division")).toHaveValue("Ikeja Judicial Division");
  await expect(page.locator("#fact-claimantAddress")).toHaveValue("12 Wombat Close, Ikeja");
  await expect(page.getByLabel("High Court of the Federal Capital Territory")).toBeChecked();
  await expect(page.getByRole("button", { name: "Draft the document" })).toBeEnabled();
});
