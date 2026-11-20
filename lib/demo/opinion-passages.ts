/**
 * Exact passages from the bundled opinions (lib/demo/court-records.ts), for
 * the precedent pages. Each was copied from the PDF page given and is
 * re-checked against that page by tests/unit/court-records.test.ts.
 * The passages live in opinion-passages.json, generated from a hand-reviewed
 * extraction; edit only with the PDF open.
 */
import type { CourtRecordId } from "./court-records";
import passages from "./opinion-passages.json";

export type PassageKind =
  | "facts"
  | "question"
  | "standard"
  | "holding"
  | "reasoning"
  | "disposition"
  | "separate";

export interface Passage {
  kind: PassageKind;
  /** 1-based page in the bundled PDF. */
  page: number;
  printedPage?: string;
  /** Which opinion the words come from. */
  speaker: string;
  quote: string;
}

export interface OpinionDetail {
  /** Author and panel as printed in the opinion. */
  author: string;
  panel: string;
  passages: Passage[];
}

export const PASSAGE_HEADINGS: Record<PassageKind, string> = {
  facts: "Facts and procedural posture",
  question: "Question presented",
  standard: "Governing standard",
  holding: "Holding",
  reasoning: "Key reasoning",
  disposition: "Disposition",
  separate: "Separate opinions",
};

export const OPINION_DETAILS = passages as Record<CourtRecordId, OpinionDetail>;
