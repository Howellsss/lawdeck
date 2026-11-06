import { expect, test } from "@playwright/test";

// Campus chat layout (docs/specs/chat.md, PRD v2.1 CH-03 to CH-07) on the test-only page.
for (const width of [360, 1280]) {
  test(`campus chat shows groups, day markers, formatted messages and the message box (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat");
    await expect(page.getByRole("heading", { name: "Lagos" })).toBeVisible();
    const list = page.getByRole("list", { name: "Messages in Lagos" });
    await expect(list.getByRole("separator", { name: "Yesterday" })).toBeVisible();
    await expect(list.getByRole("separator", { name: "Today" })).toBeVisible();
    // Formatting, links, mentions and hashtags are drawn, never shown as raw markers.
    await expect(list.locator("strong", { hasText: "Civil Litigation" })).toBeVisible();
    await expect(list.getByRole("link", { name: "#civil" })).toHaveAttribute("href", "/chat/search?tag=civil");
    await expect(list.getByRole("link", { name: "the summary" })).toHaveAttribute("rel", /noopener/);
    await expect(list.getByText("@Tunde Quokka")).toBeVisible();
    await expect(list.getByText("**")).toHaveCount(0);
    // Quick messages from the same person sit under one name.
    await expect(list.getByText("Ada Wombat", { exact: true })).toHaveCount(1);

    // The group list: in the side column on a desktop, behind the # button on a phone.
    if (width >= 768) await expect(page.getByRole("navigation", { name: "Chat groups" }).first()).toBeVisible();
    else {
      await page.getByLabel("Choose a group").click();
      await expect(page.getByRole("link", { name: /Abuja/ }).first()).toBeVisible();
      await page.getByLabel("Choose a group").click();
    }

    // The formatting bar wraps the selected words.
    const box = page.getByLabel("Message Lagos");
    await box.fill("hello");
    await box.selectText();
    await page.getByRole("button", { name: "Bold" }).click();
    await expect(box).toHaveValue("**hello**");
    await page.getByRole("button", { name: "Bullet list" }).click();
    await expect(box).toHaveValue("- **hello**");
    // Sending needs an account on the test page.
    await box.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /sign in|isn’t open/i })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
