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

// Study groups (founder, 2026-11-06): private groups in the list, invitations, a New study group box,
// and the Members tab with invite by name and the creator's settings.
for (const width of [360, 1280]) {
  test(`study groups: list, invitations, new group and members (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-members");
    if (width < 768) await page.getByLabel("Choose a group").click();
    const nav = page.getByRole("navigation", { name: "Chat groups" }).first();
    await expect(nav.getByRole("heading", { name: "Study groups" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Civil Lit squad/ })).toBeVisible();
    await expect(nav.getByRole("list", { name: "Invitations" })).toContainText("Tunde Quokka invited you to Criminal Lit night class");
    await expect(nav.getByRole("button", { name: "Join" })).toBeVisible();
    await nav.getByRole("button", { name: "New study group" }).click();
    const dialog = page.getByRole("dialog", { name: "New study group" });
    await expect(dialog.getByLabel("Group name")).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    if (width < 768) await page.getByLabel("Choose a group").click();

    await expect(page.getByRole("link", { name: "Members" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: /Members \(2\)/ })).toContainText("1 invited");
    await expect(page.getByText("Created the group")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: "Group name" })).toHaveValue("Civil Lit squad");
    await expect(page.getByRole("button", { name: "Delete group" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: /Type a name/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// Voice notes (founder, 2026-11-06): study groups only; up to 2 minutes.
for (const width of [360, 1280]) {
  test(`voice notes show in study groups, with a record button only there (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-study");
    await expect(page.getByText("Voice note · 0:42 · not available")).toBeVisible();
    await page.getByRole("button", { name: "Record a voice note" }).click();
    // The test browser has no microphone: the student is told what to do instead of a silent failure.
    const voice = page.getByRole("group", { name: "Voice note" });
    await expect(voice.getByRole("alert")).toContainText("microphone");
    await voice.getByRole("button", { name: "Cancel" }).click();
    await expect(voice).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.goto("/test-pages/chat");
    await expect(page.getByRole("button", { name: "Attach a file (PDF, Word or image, up to 25 MB)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record a voice note" })).toHaveCount(0);
  });
}

// Study together (founder, 2026-11-06): lesson cards and "This week's topic".
for (const width of [360, 1280]) {
  test(`study together: lesson cards and this week's topic (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-study");
    const card = page.getByRole("group", { name: "Lesson: Originating processes" });
    await expect(card).toContainText("Lesson · Civil Litigation");
    await expect(card).toContainText("Not yet read in full by a reviewer.");
    await expect(card.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", "/study/00000000-0000-4000-8000-000000000871");

    const week = page.getByRole("region", { name: "This week’s topic" });
    await expect(week).toContainText("Originating processes");
    await expect(week).toContainText("Set by Ada Wombat · Today");
    await expect(week.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", "/study/00000000-0000-4000-8000-000000000871");
    await expect(week.getByRole("button", { name: "Change" })).toBeVisible();
    await expect(week.getByRole("button", { name: "Clear" })).toBeVisible();

    // The picker opens from the message box; test pages have no database, so it says so plainly.
    await page.getByRole("button", { name: "Share a lesson" }).click();
    const dialog = page.getByRole("dialog", { name: "Share a lesson" });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Share" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await week.getByRole("button", { name: "Change" }).click();
    await expect(page.getByRole("dialog", { name: "This week’s topic" })).toBeVisible();
    await page.keyboard.press("Escape");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// Polls (founder, 2026-11-06): results after voting, names only when shown, the maker closes it.
for (const width of [360, 1280]) {
  test(`polls: vote, results and making a poll (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-study");
    const open = page.getByRole("group", { name: "Poll: Revision class on which day?" });
    await expect(open).toContainText("anonymous");
    await expect(open).toContainText("Vote to see the results");
    await expect(open.getByRole("button", { name: "Close poll" })).toBeVisible();
    // Test pages have no database: the student is told the vote didn't count.
    await open.getByRole("button", { name: "Monday" }).click();
    await expect(open.getByRole("alert")).toBeVisible();

    const voted = page.getByRole("group", { name: "Poll: Meet online or in person?" });
    await expect(voted.getByRole("button", { name: /Online/ })).toHaveAttribute("aria-pressed", "true");
    await expect(voted).toContainText("2 · 67%");
    await expect(voted).toContainText("Ada Wombat, Tunde Quokka");
    await expect(voted).toContainText("3 votes");
    await expect(voted.getByRole("button", { name: "Close poll" })).toHaveCount(0);

    await page.getByRole("button", { name: "Make a poll" }).click();
    const dialog = page.getByRole("dialog", { name: "Make a poll" });
    const post = dialog.getByRole("button", { name: "Post poll" });
    await expect(post).toBeDisabled();
    await dialog.getByLabel("Question").fill("Mock exam on Saturday?");
    await dialog.getByLabel("Choice 1").fill("Yes");
    await dialog.getByLabel("Choice 2").fill("No");
    await expect(post).toBeEnabled();
    for (let i = 0; i < 4; i++) await dialog.getByRole("button", { name: "Add a choice" }).click();
    await expect(dialog.getByRole("button", { name: "Add a choice" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Remove choice 6" }).click();
    await expect(dialog.getByLabel("Show who voted for each choice")).toBeVisible();
    await post.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // In campus groups votes are always anonymous.
    await page.goto("/test-pages/chat");
    await page.getByRole("button", { name: "Make a poll" }).click();
    await expect(page.getByRole("dialog", { name: "Make a poll" })).toContainText("Votes are anonymous");
    await expect(page.getByLabel("Show who voted for each choice")).toHaveCount(0);
  });
}

// Group calls in study groups (founder, 2026-11-06): the call line, and the call screen.
for (const width of [360, 1280]) {
  test(`group calls: call line and call screen (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/test-pages/chat-study");
    const line = page.getByRole("region", { name: "Group call" });
    await expect(line).toContainText("Call in progress · Ada Wombat, Tunde Quokka");
    // Test pages have no LiveKit keys: the student is told calls aren't on, not left waiting.
    await line.getByRole("button", { name: "Join call" }).click();
    await expect(line.getByRole("alert")).toContainText("aren’t switched on");

    await page.goto("/test-pages/chat-call");
    const call = page.getByRole("region", { name: "Group call" });
    await expect(call).toContainText("3 people · not recorded");
    await expect(call.getByRole("listitem", { name: "Tunde Quokka, speaking" })).toBeVisible();
    await expect(call.getByRole("listitem", { name: "Bisi Numbat, muted" })).toBeVisible();
    await expect(call.getByRole("button", { name: "Tap to hear the call" })).toBeVisible();
    await call.getByRole("button", { name: "Mute" }).click();
    await expect(call.getByRole("listitem", { name: "Ada Wombat (you), muted" })).toBeVisible();
    await expect(call.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
    await expect(call.getByRole("button", { name: "Camera on" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await call.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("status")).toHaveText("You left the call.");
  });
}

// Group quiz like Kahoot (founder, 2026-11-06): host form, a timed question, the reveal and results.
for (const width of [360, 1280]) {
  test(`group quiz: host, answer, reveal and results (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/chat-quiz");
    await expect(page.getByRole("link", { name: "Quiz" })).toHaveAttribute("aria-current", "page");
    const setup = page.getByRole("form", { name: "Host a quiz" });
    await expect(setup.getByRole("button", { name: "Create quiz" })).toBeDisabled();
    await setup.getByLabel("Topic").selectOption({ label: "Bail (6 questions)" });
    await expect(setup.getByRole("button", { name: "Create quiz" })).toBeEnabled();

    // Sound: on by default, remembered on this phone.
    await page.getByRole("button", { name: "Turn quiz sound off" }).click();
    await expect(page.getByRole("button", { name: "Turn quiz sound on" })).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.getByRole("button", { name: "Turn quiz sound on" })).toBeVisible();
    await page.getByRole("button", { name: "Turn quiz sound on" }).click();

    await page.goto("/test-pages/chat-quiz?s=ready");
    await expect(page.getByRole("region", { name: "Get ready" })).toContainText("Get ready…");
    await expect(page.getByRole("region", { name: "Get ready" }).getByText("3", { exact: true })).toBeVisible();

    await page.goto("/test-pages/chat-quiz?s=live");
    const question = page.getByRole("region", { name: "Question 2 of 5" });
    await expect(question.getByText("12s")).toBeVisible();
    await expect(question.getByText("1 of 3 answered.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next question" })).toBeDisabled();
    // Answering needs an account here: the student is told, nothing is made up.
    await question.getByRole("button", { name: /Originating summons/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: /sign in/i })).toBeVisible();

    await page.goto("/test-pages/chat-quiz?s=closed");
    await expect(page.getByText("Correct! +960 points · 🔥 2 in a row")).toBeVisible();
    const chart = page.getByRole("figure", { name: "How everyone answered" });
    await expect(chart.getByText("2 players")).toBeVisible();
    await expect(page.getByRole("region", { name: "Leaderboard" }).getByText("🔥 2")).toBeVisible();
    await expect(page.getByText("Right answer", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Leaderboard" }).getByText("1st")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next question" })).toBeEnabled();

    await page.goto("/test-pages/chat-quiz?s=done");
    const results = page.getByRole("region", { name: "Final leaderboard" });
    await expect(results.getByRole("listitem").filter({ hasText: "2nd" }).getByText("Ada Wombat").last()).toBeVisible();
    await expect(results.getByRole("list", { name: "Podium" }).getByText("1st")).toBeVisible();
    await expect(results.getByRole("list", { name: "Podium" }).getByText("Tunde Quokka")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
