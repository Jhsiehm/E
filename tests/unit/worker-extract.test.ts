// Reading uploaded files in the worker: the file must be what was announced,
// PDF and Word text comes out, and hostile files are refused.

import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { checkFile, docxPages, pdfPages, toChunks } from "@/worker/extract";
import { tinyDocx, tinyPdf } from "../shared/fixtures/files";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("worker file checks", () => {
  it("accepts the announced file and refuses a swapped, resized or disguised one", () => {
    const pdf = tinyPdf("Hello");
    const ok = {
      mime_type: "application/pdf",
      size_bytes: pdf.length,
      sha256: sha(pdf),
    };
    expect(() => checkFile(pdf, ok)).not.toThrow();
    expect(() => checkFile(pdf, { ...ok, sha256: "0".repeat(64) })).toThrow(
      /does not match/,
    );
    expect(() => checkFile(pdf, { ...ok, size_bytes: 1 })).toThrow(/size/);
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect(() =>
      checkFile(html, {
        mime_type: "application/pdf",
        size_bytes: html.length,
        sha256: sha(html),
      }),
    ).toThrow(/not a PDF or Word/);
    expect(() =>
      checkFile(pdf, {
        mime_type: DOCX,
        size_bytes: pdf.length,
        sha256: sha(pdf),
      }),
    ).toThrow(/not a PDF or Word/);
  });

  it("reads the text of a PDF page by page", async () => {
    const pages = await pdfPages(
      tinyPdf("Plaintiff alleges breach of warranty"),
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain("Plaintiff alleges breach of warranty");
  });

  it("refuses a damaged PDF with a plain reason", async () => {
    await expect(pdfPages(Buffer.from("%PDF-1.4 garbage"))).rejects.toThrow(
      /could not be opened/,
    );
  });

  it("reads the paragraphs of a Word file", () => {
    const [text] = docxPages(tinyDocx(["Motion to compel", "Smith & Jones"]));
    expect(text).toBe("Motion to compel\nSmith & Jones\n");
  });

  it("refuses a Word file without its main text", () => {
    const zip = Buffer.from(zipSync({ "evil.txt": strToU8("x") }));
    expect(() => docxPages(zip)).toThrow(/no readable text/);
  });

  it("splits long text into numbered chunks that keep their page", () => {
    const para = "A sentence of the complaint.\n";
    const chunks = toChunks([para.repeat(200), "Short page"], true);
    expect(chunks.every((c) => c.body.length <= 2000)).toBe(true);
    expect(chunks.at(-1)).toEqual({ page: 2, body: "Short page" });
    expect(
      chunks
        .filter((c) => c.page === 1)
        .map((c) => c.body)
        .join("\n").length,
    ).toBeGreaterThan(5000);
    expect(toChunks(["   \n\n "], true)).toEqual([]);
  });
});
