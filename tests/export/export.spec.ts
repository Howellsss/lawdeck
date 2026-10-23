import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Every template, for every court it is for, drawn with made-up facts long enough to run over
// several pages (src/app/test-pages). For each:
// - the on-screen pages give the page count;
// - Chromium's own print, which "Save as PDF" uses, has exactly that many A4 pages (EX-02);
// - the Word file opens in LibreOffice, is A4, and has the same number of pages (EX-01).

const dir = "src/templates/documents";
const cases = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => {
    const t = JSON.parse(readFileSync(join(dir, name), "utf8")) as { slug: string; forums: string[] };
    return (t.forums.length ? t.forums : [""]).map((forum) => ({ slug: t.slug, forum }));
  });

const work = mkdtempSync(join(tmpdir(), "lawdeck-export-"));

function pdfInfo(file: string): { pages: number; size: string } {
  const out = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  return {
    pages: Number(/^Pages:\s+(\d+)/m.exec(out)?.[1]),
    size: /^Page size:\s+(.+)$/m.exec(out)?.[1] ?? "",
  };
}

for (const { slug, forum } of cases) {
  test(`${slug}${forum ? ` (${forum})` : ""}: Word file and PDF have the on-screen pages`, async ({ page, request }) => {
    const query = `t=${slug}&f=${forum}`;
    await page.goto(`/test-pages/document?${query}`);
    const pages = page.locator("[data-page-count]");
    await expect(pages).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const onScreen = Number(await pages.getAttribute("data-page-count"));
    expect(onScreen).toBeGreaterThan(0);

    // "Save as PDF": the browser's print of the same pages.
    await page.emulateMedia({ media: "print" });
    const printed = join(work, `${slug}-${forum || "none"}-print.pdf`);
    writeFileSync(printed, await page.pdf({ preferCSSPageSize: true }));
    const print = pdfInfo(printed);
    expect(print.size).toMatch(/\(A4\)/);
    expect(print.pages, "PDF pages").toBe(onScreen);

    // The Word file, opened and printed by LibreOffice.
    const response = await request.get(`/test-pages/document/docx?${query}`);
    expect(response.status()).toBe(200);
    const docx = join(work, `${slug}-${forum || "none"}.docx`);
    writeFileSync(docx, await response.body());
    execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", work, docx], { timeout: 90_000, stdio: "ignore" });
    const word = pdfInfo(docx.replace(/\.docx$/, ".pdf"));
    expect(word.size).toMatch(/\(A4\)/);
    expect(word.pages, "Word file pages").toBe(onScreen);
  });
}
