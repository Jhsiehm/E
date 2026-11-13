// Tiny, valid PDF and Word files built in memory for tests.

import { strToU8, zipSync } from "fflate";

/** A one-page PDF that says `text`, with a correct cross-reference table. */
export function tinyPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export function tinyDocx(paragraphs: string[]): Buffer {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p.replace(/&/g, "&amp;")}</w:t></w:r></w:p>`)
    .join("");
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8(
        `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`,
      ),
    }),
  );
}
