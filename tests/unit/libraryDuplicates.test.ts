import { describe, expect, it } from "vitest";
import { alreadyInLibrary, duplicateMessage, sameFileInLibrary } from "@/server/library/duplicates";

// A stand-in for the library table (made-up rows): enough of the query builder for these checks.
type Row = { title: string; drive_file_id: string | null; file_name: string | null; size_bytes: number | null; content_sha256: string | null };
function fakeDb(rows: Row[]) {
  const query = (filters: ((r: Row) => boolean)[] = []) => {
    const run = () => ({ data: rows.filter((r) => filters.every((f) => f(r))), error: null });
    const builder = {
      select: () => builder,
      in: (col: keyof Row, values: unknown[]) => query([...filters, (r) => values.includes(r[col])]),
      eq: (col: keyof Row, value: unknown) => query([...filters, (r) => r[col] === value]),
      limit: (n: number) => Promise.resolve({ data: run().data.slice(0, n), error: null }),
      then: (resolve: (v: ReturnType<typeof run>) => unknown) => resolve(run()),
    };
    return builder;
  };
  return { from: () => query() } as never;
}

const library: Row[] = [
  { title: "Kelvin Civil", drive_file_id: "1AAAAAAAAAAAAAAA", file_name: "KELVIN CIVIL LITIGATION.pdf", size_bytes: 1629120, content_sha256: "a".repeat(64) },
  { title: "Cundy Smith Civil 2022", drive_file_id: null, file_name: "Cundy smith Civil 2022.pdf", size_bytes: 5449760, content_sha256: "b".repeat(64) },
];

describe("files already in the library", () => {
  it("are found before downloading: same Drive file, or same name and size in any course", async () => {
    const found = await alreadyInLibrary(fakeDb(library), [
      { id: "1AAAAAAAAAAAAAAA", name: "renamed.pdf", sizeBytes: 1 },
      { id: "1BBBBBBBBBBBBBBB", name: "Cundy smith Civil 2022.pdf", sizeBytes: 5449760 },
      { id: "1CCCCCCCCCCCCCCC", name: "Cundy smith Civil 2022.pdf", sizeBytes: 999 },
      { id: "1DDDDDDDDDDDDDDD", name: "NEW FILE.pdf", sizeBytes: 10 },
    ]);
    expect([...found.keys()].sort()).toEqual(["1AAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBB"]);
    expect(found.get("1BBBBBBBBBBBBBBB")).toBe("Cundy Smith Civil 2022");
  });

  it("are found after downloading by their contents, even under another name", async () => {
    const db = fakeDb(library);
    expect(await sameFileInLibrary(db, { sha256: "b".repeat(64), name: "Cundy Smith 2021-2022_Civil Litigation.pdf", size: 5449760 })).toBe(
      "Cundy Smith Civil 2022",
    );
    expect(await sameFileInLibrary(db, { sha256: "e".repeat(64), name: "Something new.pdf", size: 42 })).toBeNull();
  });

  it("are explained in plain words", () => {
    expect(duplicateMessage("Kelvin Civil")).toBe("Already in the library as “Kelvin Civil”, so it was skipped.");
  });
});
