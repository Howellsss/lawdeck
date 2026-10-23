// Splits a document into pages (step 5e). The preview measures each heading and paragraph as it
// will print, then this places them on pages of the court's paper, as Word does:
// - a heading stays on the same page as the paragraph after it (Word's "keep with next");
// - an item marked newPage starts a new page (the part after a cover page);
// - an item taller than a whole page gets a page of its own rather than being lost.
// Breaks fall between paragraphs, so a long paragraph may move whole to the next page where Word
// would split it; the export tests (step 5h) compare the two.

export type PageItem = { height: number; keepWithNext?: boolean; newPage?: boolean };

export function paginate(items: PageItem[], pageHeight: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  const startPage = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.newPage && page.length) startPage();
    // A heading needs room for itself and the first paragraph that follows it.
    const next = items[i + 1];
    const needed = item.height + (item.keepWithNext && next && !next.newPage ? next.height : 0);
    if (page.length && used + needed > pageHeight) startPage();
    page.push(i);
    used += item.height;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}
