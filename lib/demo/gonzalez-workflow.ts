/**
 * Prepared demonstration analysis for the Gonzalez demo matter.
 *
 * Written and checked by hand; Casevex AI did not produce it. Every
 * quotation is copied from the bundled PDF named by `source` and appears on
 * the PDF page given (tests/unit/court-records.test.ts checks each one).
 * The CPLR text is quoted only as the Gonzalez opinion quotes it.
 */
import type { CourtRecordId } from "./court-records";

export interface Citation {
  source: CourtRecordId;
  /** 1-based page in the bundled PDF. */
  page: number;
  /** Page number printed on that page, when it differs. */
  printedPage?: string;
  /** Who is speaking: majority, dissent, or the court in another case. */
  speaker: string;
  /** Exact wording from the PDF. */
  quote: string;
}

export interface Finding {
  heading: string;
  /** Neutral, hand-written summary of what the cited passages say. */
  summary: string;
  citations: Citation[];
}

export interface WorkflowStep {
  title: string;
  detail: string;
}

export const LABEL = "Prepared demonstration analysis";

export const RESEARCH_QUESTION =
  "How does the Second Circuit’s reasoning in Gonzalez differ from Malmberg regarding the adequacy of a trial court’s explanation for pain-and-suffering damages? Identify the governing standard, factual distinctions, and relevant passages.";

export const STEPS: WorkflowStep[] = [
  {
    title: "Review the primary opinion",
    detail:
      "Read Gonzalez v. United States, including the summary on PDF page 2 and the pain-and-suffering discussion on pages 28–39.",
  },
  {
    title: "Identify the relevant legal standard",
    detail:
      "Note the holding on the standard of review (page 23) and the Rule 52(a) explanation requirement.",
  },
  {
    title: "Examine the majority and dissent",
    detail:
      "Compare how the majority and Judge Sullivan read the district court’s explanation of the $850,000 award.",
  },
  {
    title: "Compare Gonzalez with Malmberg",
    detail:
      "Read Malmberg pages 29–31 and the Gonzalez passage that distinguishes it (pages 31–32).",
  },
  {
    title: "Review governing statutory authority",
    detail:
      "Read CPLR § 5501(c) in the official text; Gonzalez quotes it on page 18.",
  },
  {
    title: "Prepare a research memorandum for attorney review",
    detail:
      "Record each finding with its pinpoint citation, the contrary reasoning, and what has not been checked.",
  },
];

export const FINDINGS: Finding[] = [
  {
    heading: "Governing standard",
    summary:
      "Gonzalez holds that when New York law governs the measure of damages, an FTCA pain-and-suffering award is reviewed under CPLR § 5501(c)’s “deviates materially” standard, with the district court’s factual findings reviewed for clear error. Malmberg had expressly left that question open.",
    citations: [
      {
        source: "gonzalez",
        page: 23,
        speaker: "Gonzalez, majority",
        quote:
          "Therefore, we hold that “where the nature and measure of damages is governed by New York law,” Malmberg, 816 F.3d at 199, a pain-and-suffering award arising out of the FTCA should be set aside if it “deviates materially from what would be reasonable compensation,” CPLR § 5501(c).",
      },
      {
        source: "malmberg",
        page: 31,
        speaker: "Malmberg",
        quote:
          "Because we do not decide at this time the adequacy of the award, we need not decide the appropriate standard of review applicable for a district court’s FTCA damages award where the nature and measure of damages is governed by New York law.",
      },
    ],
  },
  {
    heading: "Adequacy of the explanation",
    summary:
      "In Malmberg, the court vacated a pain-and-suffering award because the district court gave too little reasoning to permit review. In Gonzalez, the majority found the district court’s explanation sufficient for meaningful appellate review under Rule 52.",
    citations: [
      {
        source: "malmberg",
        page: 30,
        speaker: "Malmberg",
        quote:
          "This sparse analysis by the district court provides little on which we may base our review, and thus fails as a matter of law.",
      },
      {
        source: "malmberg",
        page: 31,
        speaker: "Malmberg",
        quote:
          "Absent further analysis and clearer reasoning by the district court, we cannot make a fair determination about whether the pain and suffering award is inadequate.",
      },
      {
        source: "gonzalez",
        page: 31,
        speaker: "Gonzalez, majority",
        quote:
          "Under these circumstances, the district court satisfied Rule 52 because its analysis is sufficient for us to exercise meaningful appellate review to determine whether the amount of the award was adequate under New York law.",
      },
    ],
  },
  {
    heading: "Factual distinctions",
    summary:
      "The majority distinguished Malmberg on what the district court did: in Gonzalez it explained the relevant factors and evidence, cited three analogous New York cases, and compared their facts. The Malmberg district court cited no case for the range it used.",
    citations: [
      {
        source: "gonzalez",
        page: 32,
        speaker: "Gonzalez, majority",
        quote:
          "In contrast, as noted above, the district court here (1) explained the relevant factors and the trial evidence relating to those factors; (2) specifically cited to three analogous New York cases; and (3) articulated the material facts from those cases, which it used to compare those awards to the factual circumstances of the instant case.",
      },
    ],
  },
  {
    heading: "Contrary reasoning",
    summary:
      "Judge Sullivan, dissenting in part and relying on Malmberg, would have vacated the pain-and-suffering award and remanded: in his view the district court identified comparable cases but did not explain how they led to $850,000. A dissent is not controlling law.",
    citations: [
      {
        source: "gonzalez",
        page: 50,
        printedPage: "3",
        speaker: "Gonzalez, partial dissent (Sullivan, J.)",
        quote:
          "But its ultimate determination – that “[u]pon reviewing the facts of and damages awarded in these cases, $850,000 is an appropriate award here for Salazar’s pain and suffering,” id. at 349 – is wholly conclusory and untethered to any analysis of the cases or the evidence in the record.",
      },
    ],
  },
  {
    heading: "Statutory authority",
    summary:
      "CPLR § 5501(c) supplies the “deviates materially” standard. The text below is quoted as it appears in the Gonzalez opinion; read the official statute before relying on it.",
    citations: [
      {
        source: "gonzalez",
        page: 18,
        speaker: "Gonzalez, majority, quoting CPLR § 5501(c)",
        quote:
          "Under CPLR § 5501(c), New York’s appellate courts “shall determine that an award is excessive or inadequate if it deviates materially from what would be reasonable compensation.”",
      },
    ],
  },
];

export const LIMITATIONS = [
  "This analysis was prepared and checked by hand for the demo. Casevex AI did not write it, and live research is turned off in the demo.",
  "Subsequent treatment and current good-law status of Gonzalez and Malmberg have not been checked.",
  "Page numbers are pages of the bundled slip-opinion PDFs, not reporter pages. The reporter citations were supplied with the sources and have not been checked against the reporter.",
  "The CPLR § 5501(c) text is quoted from the Gonzalez opinion; the official statute was not retrieved for this demo.",
  "This is a research aid for attorney review, not legal advice.",
];
