/**
 * Prepared document comparison for the Friday demo.
 *
 * Source: Gonzalez v. United States, No. 21-548-cv (2d Cir. Aug. 24, 2023),
 * a public court opinion. Every quotation and page number below was read by
 * hand from that PDF (identified by sha256) with pdftotext and checked again
 * against the page; nothing here is generated text. The majority opinion and
 * the partial dissent are printed in the same file.
 *
 * Scope: the example appears only on a matter with exactly this name that
 * holds a file with exactly this sha256. The view link is pinned to that
 * version, so a different or replaced file can never be cited.
 */
export interface PreparedExcerpt {
  /** Short role shown above the excerpt. */
  role: string;
  /** Title of the opinion as printed. */
  title: string;
  /** Date as printed in the document, or null when it has none. */
  date: string | null;
  /** 1-based page in the PDF file. */
  page: number;
  /** Page number printed on that page, when it differs from the PDF page. */
  printedPage?: string;
  /** Exact wording from the PDF. */
  quote: string;
}

export interface PreparedComparison {
  matterName: string;
  /** sha256 of the original file the quotations were read from. */
  sha256: string;
  label: string;
  /** Overview button and view heading. */
  action: string;
  left: PreparedExcerpt;
  right: PreparedExcerpt;
  /** One neutral sentence about what differs. */
  difference: string;
}

export const GONZALEZ_COMPARISON: PreparedComparison = {
  matterName: "Gonzalez v. United States",
  sha256: "0593aa70a7dede5efeecc64e41d4cf38f9e076d56d62c2d29f3281bdb1522580",
  label: "Prepared example · Public court record",
  action: "Compare the judges’ views on damages",
  left: {
    role: "Majority opinion",
    title: "Opinion of the Court (Bianco, J.)",
    date: "August 24, 2023",
    page: 39,
    quote:
      "In sum, we conclude that the $850,000 award for pain and suffering did not deviate materially from what would constitute reasonable compensation under New York law.",
  },
  right: {
    role: "Partial dissent",
    title: "Sullivan, J., concurring in part and dissenting in part",
    date: "August 24, 2023",
    page: 54,
    printedPage: "7",
    quote:
      "In short, despite the majority’s steadfast efforts to justify the district court’s conclusion, I find myself still searching for the basis for the district court’s pain-and-suffering award. For this reason, I would vacate the award and remand for reconsideration and further explanation.",
  },
  difference:
    "The majority affirms the $850,000 pain-and-suffering award, while the partial dissent would vacate it and send it back to the trial court for a fuller explanation.",
};

export interface ComparableDocument {
  id: string;
  sha256?: string | null;
}

/**
 * The prepared comparison and the document it cites, for this matter only.
 * Returns null on every other matter, and when the exact file is not there.
 */
export function preparedComparisonFor(
  matterName: string,
  documents: readonly ComparableDocument[],
): { comparison: PreparedComparison; documentId: string } | null {
  const c = GONZALEZ_COMPARISON;
  if (matterName.trim() !== c.matterName) return null;
  const doc = documents.find((d) => d.sha256 === c.sha256);
  return doc ? { comparison: c, documentId: doc.id } : null;
}
