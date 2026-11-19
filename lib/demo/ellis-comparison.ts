/**
 * Prepared comparison for the fictional Ellis matter (Friday demo).
 *
 * Scope: this example appears only on the one matter below, and only when
 * both pinned document versions are present in it. Every quotation and page
 * number here was read by hand from the original fictional PDFs (identified
 * by sha256) and must be re-checked if either file is replaced. Nothing here
 * is generated text.
 */
export interface PreparedExcerpt {
  /** Short role shown above the excerpt, e.g. "Imaging report". */
  role: string;
  documentId: string;
  versionId: string;
  /** sha256 of the original file the quotation was read from. */
  sha256: string;
  /** Document title as printed in the PDF. */
  title: string;
  /** Date as printed in the PDF, or null when the record has none. */
  date: string | null;
  /** 1-based page in the PDF file (not a printed page label). */
  page: number;
  /** Exact wording from the PDF. */
  quote: string;
}

export interface PreparedComparison {
  workspaceId: string;
  matterId: string;
  label: string;
  title: string;
  left: PreparedExcerpt;
  right: PreparedExcerpt;
  /** One neutral sentence about what differs. */
  difference: string;
}

export const ELLIS_COMPARISON: PreparedComparison | null = null;

/** The prepared comparison for this matter, if any. Never returns another matter's example. */
export function preparedComparisonFor(
  matterId: string,
  documentIds: readonly string[],
): PreparedComparison | null {
  const c = ELLIS_COMPARISON;
  if (!c || c.matterId !== matterId) return null;
  if (
    !documentIds.includes(c.left.documentId) ||
    !documentIds.includes(c.right.documentId)
  )
    return null;
  return c;
}
