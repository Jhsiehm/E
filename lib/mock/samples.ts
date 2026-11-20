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
/** Words that tie a question to the prepared Nexora answer. */
const PREPARED_TOPIC =
  /\b(nexora|ruling|opinion|confidential|trade[- ]secret|misappropriat\w*|declaration|filing|argument|motion to compel)\b/i;

/**
 * The simulated reply to a demo chat question. The prepared Anderson answer
 * is shown only for questions about the sample ruling; any other question
 * says plainly that it was not researched, so an unrelated question never
 * receives an answer about something else.
 */
export function demoAnswer(
  matter: { id: string; name: string },
  question: string,
): { text: string; sources: Source[] } {
  if (matter.id === "anderson" && PREPARED_TOPIC.test(question))
    return { text: sampleAnswer, sources };
  const prepared =
    matter.id === "anderson"
      ? "This demo has a prepared answer only for questions about the sample Nexora ruling, such as the suggested questions below."
      : matter.id === "gonzalez"
        ? "This demo has no AI answers for this public court record. A prepared, hand-checked analysis with pinpoint citations is in the Legal research workflow on the Overview tab."
        : `This is a simulated research response for ${matter.name}.`;
  return {
    text: `${prepared} No live legal research was performed for this question, and no answer is given.\n\nIn a pilot account, Casevex searches the enabled public legal sources and states only claims whose quotations and support were checked, each linked to its source.\n\nRecommended next step\nTry one of the suggested questions, or ask this question again in a pilot account.`,
    sources: [],
  };
}
export const sampleAnswer =
  "In this fictional scenario, the ruling may strengthen the misappropriation claim. [1]\n\nThe sample opinion reads confidential information broadly. Compare its reasoning with the safeguards described in the declaration, and distinguish any facts that differ from this matter. [1] [3]\n\nRecommended next step\nReview the draft motion and update the proposed argument only after an attorney has checked the underlying opinion and record. [2]";
