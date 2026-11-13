import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { JobError } from "./types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 2000;
const MAX_TEXT_CHARS = 5_000_000;
const CHUNK_CHARS = 2000;
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface Expected {
  mime_type: string;
  size_bytes: number | string; // Postgres bigint arrives as a string
  sha256: string;
}

export interface Chunk {
  page: number | null;
  body: string;
}

/**
 * Confirms the file is the one that was announced, and that its contents
 * really are a PDF or Word file. The name and the browser's claim are not
 * trusted (OWASP file upload guidance).
 */
export function checkFile(buf: Buffer, e: Expected) {
  if (buf.length !== Number(e.size_bytes))
    throw new JobError("The file changed size after upload.", false);
  if (createHash("sha256").update(buf).digest("hex") !== e.sha256)
    throw new JobError("The file does not match what was uploaded.", false);
  const head = buf.subarray(0, 5).toString("latin1");
  const ok =
    e.mime_type === "application/pdf"
      ? head === "%PDF-"
      : e.mime_type === DOCX && head.startsWith("PK\u0003\u0004");
  if (!ok)
    throw new JobError(
      "The file's contents are not a PDF or Word document.",
      false,
    );
}

/** Text of each page of a PDF. Scans without a text layer come back empty. */
export async function pdfPages(buf: Buffer): Promise<string[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf), {
      isEvalSupported: false,
    });
  } catch {
    throw new JobError(
      "The PDF could not be opened. It may be damaged or password-protected.",
      false,
    );
  }
  if (pdf.numPages > MAX_PAGES)
    throw new JobError(`The PDF has more than ${MAX_PAGES} pages.`, false);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

/** Text of a Word file, as one "page" (Word files have no fixed pages). */
export function docxPages(buf: Buffer): string[] {
  let xml: Uint8Array | undefined;
  try {
    const files = unzipSync(new Uint8Array(buf), {
      // Only open the main text, and refuse a "zip bomb" that inflates hugely.
      filter: (f) =>
        f.name === "word/document.xml" && f.originalSize <= 50 * 1024 * 1024,
    });
    xml = files["word/document.xml"];
  } catch {
    throw new JobError(
      "The Word file could not be opened. It may be damaged.",
      false,
    );
  }
  if (!xml) throw new JobError("The Word file has no readable text.", false);
  const text = new TextDecoder()
    .decode(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:(br|cr)\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return [text];
}

/** Splits page text into chunks of about 2,000 characters on line breaks. */
export function toChunks(pages: string[], paged: boolean): Chunk[] {
  const chunks: Chunk[] = [];
  let total = 0;
  pages.forEach((raw, i) => {
    const text = raw
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    total += text.length;
    if (total > MAX_TEXT_CHARS)
      throw new JobError(
        "The document has more text than Casevex can read at once.",
        false,
      );
    let rest = text;
    while (rest.length > 0) {
      let cut =
        rest.length <= CHUNK_CHARS
          ? rest.length
          : rest.lastIndexOf("\n", CHUNK_CHARS);
      if (cut < CHUNK_CHARS / 2) cut = Math.min(rest.length, CHUNK_CHARS);
      const body = rest.slice(0, cut).trim();
      if (body) chunks.push({ page: paged ? i + 1 : null, body });
      rest = rest.slice(cut);
    }
  });
  return chunks;
}
