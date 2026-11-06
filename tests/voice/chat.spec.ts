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
    // Files show as cards with their kind and size; the paperclip attaches more.
    const files = list.getByRole("list", { name: "Attached files" });
    await expect(files.getByText("Order 3 handout.pdf")).toBeVisible();
    await expect(files.getByText("PDF · 471 KB · not available")).toBeVisible();
    await expect(page.getByRole("button", { name: /Attach a file/ })).toBeVisible();

    // The header: members (a number only), search in this group, and the two tabs.
    await expect(page.getByText("42 members", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Files & links" })).toHaveAttribute("href", "/chat/lagos/files");
    await expect(page.getByRole("link", { name: "Messages" })).toHaveAttribute("aria-current", "page");
    // Other people's messages can be reported with a reason; your own can be deleted, not reported.
    const handout = list.getByRole("listitem").filter({ hasText: "Here is the class handout." });
    await handout.hover();
    await handout.getByRole("button", { name: "Report this message" }).click();
    const report = page.getByRole("form", { name: "Report this message" });
    await report.getByRole("button", { name: "Send report" }).click();
    await expect(report.getByRole("alert")).toHaveText("Choose a reason.");
    await report.getByLabel("Exam cheating or leaked papers").check();
    await report.getByRole("button", { name: "Cancel" }).click();
    await expect(report).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hide this message" })).toHaveCount(0);
    // Add link: the words show in the box; the address is kept until sending.
    await box.fill("See ");
    await page.getByRole("button", { name: "Link" }).click();
    const dialog = page.getByRole("dialog", { name: "Add link" });
    await dialog.getByLabel("Text").fill("Test");
    await dialog.getByLabel("Link").fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toContainText("web address");
    await dialog.getByLabel("Link").fill("mylawdeck.com");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(box).toHaveValue("See Test");
    await expect(page.getByLabel("Links in this message")).toContainText("https://mylawdeck.com");
    // Aa hides and shows the formatting row; the emoji button adds an emoji; @ starts a mention.
    await page.getByRole("button", { name: "Hide formatting" }).click();
    await expect(page.getByRole("toolbar", { name: "Formatting" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show formatting" }).click();
    await expect(page.getByRole("button", { name: "Underline" })).toBeVisible();
    await page.getByRole("button", { name: "Add an emoji" }).click();
    const emojis = page.getByRole("dialog", { name: "Emojis" });
    await expect(emojis.getByRole("region", { name: "Flags" })).toBeAttached();
    await emojis.getByLabel("Search emojis").fill("nigeria");
    await expect(emojis.getByRole("button", { name: "flag Nigeria" })).toBeVisible();
    await emojis.getByLabel("Search emojis").fill("folded");
    await emojis.getByRole("button", { name: "folded hands", exact: true }).click();
    await expect(box).toHaveValue("See Test🙏");
    await page.getByRole("button", { name: "Mention someone" }).click();
    await expect(box).toHaveValue("See Test🙏 @");
    // Sending needs an account on the test page.
    await box.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /sign in|isn’t open/i })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// Verification before chat (founder, 2026-11-06): students send their Law School ID; aspirants their
// university ID, for the Aspirants group only.
for (const width of [360, 1280]) {
  test(`students verify with their ID before joining chat (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/chat-verify");
    await expect(page.getByLabel("A Law School student")).toBeChecked();
    await expect(page.getByLabel("Your campus")).toHaveValue("lagos");
    await expect(page.getByLabel("Your Law School number")).toBeVisible();
    await expect(page.getByText(/deleted as soon as they decide/)).toBeVisible();
    await page.getByLabel("A Law School aspirant").check();
    await expect(page.getByLabel("Your campus")).toHaveCount(0);
    await expect(page.getByLabel("Your university matriculation number")).toBeVisible();
    await expect(page.getByLabel(/university ID or final-year letter/).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// A group's Files & links tab lists the files and links shared there.
for (const width of [360, 1280]) {
  test(`a group's Files & links lists shared files and links (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-files");
    await expect(page.getByRole("link", { name: "Files & links" })).toHaveAttribute("aria-current", "page");
    const list = page.getByRole("list", { name: "Files and links in Lagos" });
    await expect(list.getByText("Order 3 handout.pdf")).toBeVisible();
    await expect(list.getByRole("link", { name: "the summary" })).toHaveAttribute("href", "https://mylawdeck.com/diary");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
