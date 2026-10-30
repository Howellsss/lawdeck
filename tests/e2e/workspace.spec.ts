import { expect, test } from "@playwright/test";

// Signed-out visitors: private pages ask them to sign in and never show data.
const someId = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

for (const [path, heading] of [
  ["/projects", "Sign in to see your projects"],
  [`/projects/${someId}`, "Sign in to see your projects"],
  [`/chats/${someId}`, "Sign in to see your chats"],
  ["/courses", "Sign in to see your courses"],
  ["/courses/civil-litigation", "Sign in to see your courses"],
  ["/practice", "Sign in to see your practice sets"],
  ["/practice/new", "Sign in to see your practice sets"],
  [`/practice/${someId}`, "Sign in to see your practice sets"],
  ["/briefs", "Sign in to see your briefs"],
  ["/practice/mark", "Sign in to see your marked answers"],
  [`/practice/mark/${someId}`, "Sign in to see your marked answers"],
  [`/briefs/${someId}`, "Sign in to see your briefs"],
] as const) {
  test(`${path} asks visitors to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const signIn = page.getByRole("main").getByRole("link", { name: "Sign in" });
    await expect(signIn).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(path)}`);
  });
}

test("Recents tells visitors to sign in", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "phone-360") await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByText("Sign in to keep your chats.").filter({ visible: true })).toBeVisible();
});

// The chat menu (⋯: rename, move, delete) belongs to signed-in students' own chats only.
test("visitors get no chat options", async ({ page }, testInfo) => {
  await page.goto(`/chats/${someId}`);
  await expect(page.getByRole("heading", { name: "Sign in to see your chats" })).toBeVisible();
  if (testInfo.project.name === "phone-360") await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: /^Options for/ })).toHaveCount(0);
});

test("the menu marks the current section", async ({ page }, testInfo) => {
  await page.goto("/projects");
  if (testInfo.project.name === "phone-360") await page.getByRole("button", { name: "Open menu" }).click();
  const projects = page.getByRole("link", { name: "Projects", exact: true }).filter({ visible: true });
  await expect(projects).toHaveAttribute("aria-current", "page");
});

test("the Library page is hidden from visitors", async ({ page }) => {
  // The role is checked after the page starts streaming, so the content (not the status code)
  // says "not found". What matters: no library content or upload form is ever shown.
  await page.goto("/admin/library");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toHaveCount(0);
  await expect(page.getByText("Add to the library")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("the library search test page is hidden from visitors", async ({ page }) => {
  await page.goto("/admin/library/search");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test the search" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search" })).toHaveCount(0);
});

test("visitors do not see the Library link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Library" })).toHaveCount(0);
});

test("library review pages are hidden from visitors", async ({ page }) => {
  await page.goto("/admin/library/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision" })).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("the law changes page is hidden from visitors", async ({ page }) => {
  await page.goto("/admin/library/law-changes");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Law changes" })).toHaveCount(0);
});

test("the answer test pages are hidden from visitors", async ({ page }) => {
  for (const path of ["/admin/eval", "/admin/eval/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Answer tests" })).toHaveCount(0);
    await expect(page.getByRole("radio")).toHaveCount(0);
  }
});

test("the template pages are hidden from visitors", async ({ page }) => {
  for (const path of ["/admin/templates", "/admin/templates/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("button", { name: /load from files|approve/i })).toHaveCount(0);
  }
});

test("the marking guide pages are hidden from visitors", async ({ page }) => {
  for (const path of ["/admin/rubrics", "/admin/rubrics/new", "/admin/rubrics/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /marking guide/i })).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  }
});

test("the Word download refuses visitors", async ({ request }) => {
  const response = await request.get(`/api/documents/${someId}/docx`);
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).not.toContain("wordprocessingml");
});

test("Save as PDF asks visitors to sign in", async ({ page }) => {
  const path = `/print/documents/${someId}`;
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Sign in to see your documents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(path)}`);
  await expect(page.locator("[data-page-count]")).toHaveCount(0);
});

// The export test's sample pages (step 5h) exist only when LAWDECK_TEST_PAGES=1, never on the live site.
test("the test-only document pages are not there", async ({ page, request }) => {
  await page.goto("/test-pages/document?t=writ-of-summons&f=lagos-high-court");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator("[data-page-count]")).toHaveCount(0);
  const docx = await request.get("/test-pages/document/docx?t=writ-of-summons&f=lagos-high-court");
  expect(docx.status()).toBe(404);
  expect(docx.headers()["content-type"] ?? "").not.toContain("wordprocessingml");
});

test("the test-only voice page is not there", async ({ page }) => {
  await page.goto("/test-pages/voice");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Voice mode/ })).toHaveCount(0);
});

test("My uploads asks visitors to sign in and offers no upload", async ({ page }) => {
  await page.goto("/uploads");
  await expect(page.getByRole("heading", { name: "Sign in to upload" })).toBeVisible();
  await expect(page.getByLabel("Add a file")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I understand" })).toHaveCount(0);
});

test("A shared link asks visitors to sign in and shows nothing of the shared work", async ({ page }) => {
  const path = `/shared/${"a".repeat(64)}`;
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Sign in to see shared work" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(path)}`);
  await expect(page.locator("[data-page-count]")).toHaveCount(0);
});

test("Exports ask visitors to sign in and give them no file", async ({ page, request }) => {
  const id = "aaaaaaaa-0000-4000-8000-000000000001";
  const word = await request.get(`/api/exports/chat/${id}`);
  expect(word.status()).toBe(401);
  expect(word.headers()["content-type"] ?? "").not.toContain("wordprocessingml");
  await page.goto(`/print/study/brief/${id}`);
  await expect(page.getByRole("heading", { name: "Sign in to save your work" })).toBeVisible();
});

test("Account asks visitors to sign in and offers no delete button", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Sign in to see your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
});

test("Anyone can open the takedown form; empty boxes are explained", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Request removal of material" }).click();
  await expect(page.getByRole("heading", { name: "Request removal" })).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter a real email address.")).toBeVisible();
});

test("Reports and takedown requests are hidden from visitors", async ({ page }) => {
  for (const path of ["/admin/reports", "/admin/takedowns"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("button", { name: /mark resolved|mark done/i })).toHaveCount(0);
  }
});

test("The pilot page is hidden from visitors", async ({ page }) => {
  await page.goto("/admin/pilot");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("button", { name: /create invite code/i })).toHaveCount(0);
});

test("The users dashboard is hidden from visitors", async ({ page }) => {
  for (const path of ["/admin/users", "/admin/users?q=a&payment=paid", "/admin/users/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a", "/admin/users/usage", "/admin/users/usage?days=7"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("@")).toHaveCount(0);
  }
});

test("Source tracing is hidden from visitors (admins only)", async ({ page }) => {
  for (const path of ["/admin/answers/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a", "/admin/answers/not-an-id"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("drive.google.com")).toHaveCount(0);
  }
});

test("The account page asks visitors to sign in before any invite code", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Sign in to see your account" })).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveCount(0);
});

test("The phone menu scrolls, so every link and the account row can be reached", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 420 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  const last = menu.getByRole("link", { name: "Drafting catalogue" });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  // The account row stays pinned at the bottom of the menu.
  await expect(menu.getByRole("link", { name: "Sign in" })).toBeInViewport();
});
