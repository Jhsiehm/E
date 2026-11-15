// Adding many documents at once: the checks, the list and the queue.

import { describe, expect, it } from "vitest";
import {
  checkFile,
  filesFromDrop,
  runQueue,
  toItems,
} from "@/lib/api/upload-batch";

const file = (name: string, size = 10) =>
  new File([new Uint8Array(size)], name, { lastModified: 1 });

describe("upload batch", () => {
  it("explains in plain words why a file can't be added", () => {
    expect(checkFile(file("brief.pdf"))).toBeNull();
    expect(checkFile(file("Brief.DOCX"))).toBeNull();
    expect(checkFile(file("old.doc"))).toMatch(/Save it as .docx/);
    expect(checkFile(file("photo.jpg"))).toMatch(/Only PDF and Word/);
    expect(checkFile(file("README"))).toMatch(/Only PDF and Word/);
    expect(checkFile(file("empty.pdf", 0))).toMatch(/empty/);
    expect(checkFile(file("big.pdf", 20 * 1024 * 1024 + 1))).toMatch(/20 MB/);
  });

  it("skips system files and duplicates, and marks bad files", () => {
    const first = toItems([file("a.pdf"), file(".DS_Store"), file("x.png")]);
    expect(first.map((i) => [i.file.name, i.status])).toEqual([
      ["a.pdf", "waiting"],
      ["x.png", "skipped"],
    ]);
    const more = toItems(
      [file("a.pdf"), file("b.docx"), file("~$b.docx")],
      first,
    );
    expect(more.map((i) => i.file.name)).toEqual(["b.docx"]);
    expect(new Set([...first, ...more].map((i) => i.id)).size).toBe(3);
  });

  it("keeps going when one upload fails", async () => {
    const done: number[] = [];
    const failed: number[] = [];
    await runQueue(
      [1, 2, 3, 4, 5],
      async (n) => {
        if (n === 2) throw new Error("no");
        done.push(n);
      },
      (n) => failed.push(n),
      2,
    );
    expect(done.sort()).toEqual([1, 3, 4, 5]);
    expect(failed).toEqual([2]);
  });

  it("reads every file inside a dropped folder", async () => {
    const entry = (f: File) => ({
      isFile: true,
      isDirectory: false,
      name: f.name,
      file: (ok: (f: File) => void) => ok(f),
    });
    const batches = [[entry(file("one.pdf")), entry(file("two.docx"))], []];
    const folder = {
      isFile: false,
      isDirectory: true,
      name: "Smith v Jones",
      createReader: () => ({
        readEntries: (ok: (e: unknown[]) => void) => ok(batches.shift() ?? []),
      }),
    };
    const data = {
      items: [{ kind: "file", webkitGetAsEntry: () => folder }],
      files: [],
    } as unknown as DataTransfer;
    const files = await filesFromDrop(data);
    expect(files.map((f) => f.name)).toEqual(["one.pdf", "two.docx"]);
  });
});
