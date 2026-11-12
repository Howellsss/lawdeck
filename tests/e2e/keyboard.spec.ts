import { expect, test } from "@playwright/test";

// Keyboard-only use (Phase 1 exit check; WCAG 2.4.3 and 2.4.7).

test("the phone menu returns focus to its button when closed with Escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "The menu button only exists on phones.");
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Close menu" }).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test("the message box shows where keyboard focus is", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("What are we working on?").focus();
  const outline = await page
    .locator("form")
    .filter({ has: page.getByLabel("What are we working on?") })
    .evaluate((form) => getComputedStyle(form).outlineStyle);
  expect(outline).not.toBe("none");
});

test("Enter starts a new line in the question box instead of sending (founder, 2026-11-12)", async ({ page }) => {
  await page.goto("/");
  const box = page.getByLabel("What are we working on?");
  await box.fill("First line");
  await box.press("Enter");
  await box.pressSequentially("Second line");
  await expect(box).toHaveValue("First line\nSecond line");
  await expect(page).toHaveURL(/\/$/);
});
