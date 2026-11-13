import type { Source } from "./types";

export const TODAY = "2026-11-11";
export const disclaimer =
  "Research aid for attorney review. Confirm each authority before filing.";
export const sources: Source[] = [
  {
    index: 1,
    title: "Second Circuit ruling",
    meta: "U.S. v. Nexora Tech, 138 F.4th 427 · Fictional sample",
    href: "/precedents/nexora",
    verified: true,
  },
  {
    index: 2,
    title: "Motion to compel (draft)",
    meta: "DOCX · 845 KB · Sample document",
    href: "/matters/anderson/documents",
    verified: true,
  },
  {
    index: 3,
    title: "Trade secret declaration",
    meta: "PDF · 2.4 MB · Sample document",
    href: "/matters/anderson/documents",
    verified: true,
  },
];
export const sampleAnswer =
  "In this fictional scenario, the ruling may strengthen the misappropriation claim. [1]\n\nThe sample opinion reads confidential information broadly. Compare its reasoning with the safeguards described in the declaration, and distinguish any facts that differ from this matter. [1] [3]\n\nRecommended next step\nReview the draft motion and update the proposed argument only after an attorney has checked the underlying opinion and record. [2]";
