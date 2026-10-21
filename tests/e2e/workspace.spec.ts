import { expect, test } from "@playwright/test";

// Signed-out visitors: private pages ask them to sign in and never show data.
const someId = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

for (const [path, heading] of [
  ["/projects", "Sign in to see your projects"],
  [`/projects/${someId}`, "Sign in to see your projects"],
  [`/chats/${someId}`, "Sign in to see your chats"],
  ["/courses", "Sign in to see your courses"],
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
