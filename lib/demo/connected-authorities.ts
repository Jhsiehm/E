/**
 * Authorities the Gonzalez opinion relies on, shown as connected precedents.
 *
 * No court PDF is bundled for these: quotations come from the CourtListener
 * opinion text and are cited by reporter page. The per-page text used is
 * kept in tests/fixtures/courtlistener/, and tests/unit/connected-authorities.test.ts
 * re-checks every quotation against its page. The `gonzalez` passage is
 * where the bundled Gonzalez PDF cites the authority (also re-checked).
 */
export type ConnectedId = "gasperini" | "henry" | "disorbo";

export interface ReporterPassage {
  kind: "holding" | "relied_on" | "reasoning" | "disposition" | "separate";
  /** Page in the official reporter. */
  reporterPage: string;
  speaker: string;
  quote: string;
  /** Test fixture holding that opinion's text, split by reporter page. */
  fixture: string;
}

export interface ConnectedAuthority {
  id: ConnectedId;
  caseName: string;
  citation: string;
  court: string;
  decidedAt: string;
  author: string;
  /** Stable public page for the opinion text. */
  url: string;
  topics: string[];
  /** Neutral sentence on how Gonzalez uses it. */
  connection: string;
  /** Where Gonzalez cites it: PDF page of the bundled opinion and its words. */
  gonzalez: { page: number; quote: string };
  passages: ReporterPassage[];
}

export const REPORTER_HEADINGS: Record<ReporterPassage["kind"], string> = {
  holding: "Holding",
  relied_on: "Passage Gonzalez relies on",
  reasoning: "Key reasoning",
  disposition: "Disposition",
  separate: "Separate opinions",
};

export const CONNECTED: Record<ConnectedId, ConnectedAuthority> = {
  gasperini: {
    id: "gasperini",
    caseName: "Gasperini v. Center for Humanities, Inc.",
    citation: "518 U.S. 415 (1996)",
    court: "U.S. Supreme Court",
    decidedAt: "1996-06-24",
    author:
      "Ginsburg, J., delivered the opinion of the Court. Stevens, J., filed a dissenting opinion. Scalia, J., joined by Rehnquist, C.J., and Thomas, J., filed a dissenting opinion.",
    url: "https://www.courtlistener.com/opinion/2528498/gasperini-v-center-for-humanities-inc/",
    topics: ["Damages", "CPLR § 5501(c)"],
    connection:
      "Gonzalez relies on Gasperini for the “deviates materially” standard of CPLR § 5501(c) and its effect on the size of awards. Gasperini itself describes § 5501(c) as both “substantive” and “procedural.”",
    gonzalez: {
      page: 21,
      quote:
        "In Gasperini, in holding that Section 5501(c) is substantive rather than procedural for Erie purposes, the Supreme Court emphasized the impact that the standard of review under Section 5501(c) can have on the amount of a damages award.",
    },
    passages: [
      {
        kind: "holding",
        reporterPage: "419",
        speaker: "Opinion of the Court (Ginsburg, J.)",
        quote:
          "We hold that New York’s law controlling compensation awards for excessiveness or inadequacy can be given effect, without detriment to the Seventh Amendment, if the review standard set out in CPLR § 5501(c) is applied by the federal trial court judge, with appellate control of the trial court’s ruling limited to review for “abuse of discretion.”",
        fixture: "gasperini-majority-9782762.txt",
      },
      {
        kind: "relied_on",
        reporterPage: "425",
        speaker: "Opinion of the Court (Ginsburg, J.)",
        quote:
          "Although phrased as a direction to New York’s intermediate appellate courts, §5501(c)’s “deviates materially” standard, as construed by New York’s courts, instructs state trial judges as well.",
        fixture: "gasperini-majority-9782762.txt",
      },
      {
        kind: "reasoning",
        reporterPage: "426",
        speaker: "Opinion of the Court (Ginsburg, J.)",
        quote:
          "As the parties’ arguments suggest, CPLR § 5501(c), appraised under Erie R. Co. v. Tompkins, 304 U. S. 64 (1938), and decisions in Erie’s path, is both “substantive” and “procedural”: “substantive” in that §5501(c)’s “deviates materially” standard controls how much a plaintiff can be awarded; “procedural” in that § 5501(c) assigns decisionmaking authority to New York's Appellate Division.",
        fixture: "gasperini-majority-9782762.txt",
      },
      {
        kind: "reasoning",
        reporterPage: "438",
        speaker: "Opinion of the Court (Ginsburg, J.)",
        quote:
          "Within the federal system, practical reasons combine with Seventh Amendment constraints to lodge in the district court, not the court of appeals, primary responsibility for application of §5501(c)’s “deviates materially” check.",
        fixture: "gasperini-majority-9782762.txt",
      },
      {
        kind: "separate",
        reporterPage: "440",
        speaker: "Stevens, J., dissenting",
        quote:
          "That New York has chosen to tie its damages ceiling to awards traditionally recovered in similar cases, rather than to a legislatively determined but inflexible monetary sum, is none of our concern.",
        fixture: "gasperini-stevens-9782763.txt",
      },
      {
        kind: "separate",
        reporterPage: "449",
        speaker:
          "Scalia, J., dissenting (joined by Rehnquist, C.J., and Thomas, J.)",
        quote:
          "Such unreasoned capitulation to the nullification of what was long regarded as a core component of the Bill of Rights — the Seventh Amendment’s prohibition on appellate reexamination of civil jury awards— is wrong. It is not for us, much less for the Courts of Appeals, to decide that the Seventh Amendment’s restriction on federal-court review of jury findings has outlived its usefulness.",
        fixture: "gasperini-scalia-9782764.txt",
      },
    ],
  },
  henry: {
    id: "henry",
    caseName: "Henry v. Champlain Enterprises, Inc.",
    citation: "445 F.3d 610 (2d Cir. 2006)",
    court: "Second Circuit",
    decidedAt: "2006-04-26",
    author: "Sotomayor, Circuit Judge, for the panel.",
    url: "https://www.courtlistener.com/opinion/8439241/henry-v-champlain-enterprises-inc/",
    topics: ["Damages", "Rule 52(a)"],
    connection:
      "Gonzalez quotes Henry for what Rule 52(a) requires of a damages finding, then holds Henry “similarly inapposite” because the Henry award was an unexplained valuation figure. The Henry language is itself quoted from Davis v. N.Y. City Housing Authority.",
    gonzalez: {
      page: 26,
      quote:
        "Under Rule 52, courts must “adequately explain the subsidiary facts and methodology underlying the ultimate [damages] finding[s],” but are “not required to provide lengthy analyses.”",
    },
    passages: [
      {
        kind: "relied_on",
        reporterPage: "622",
        speaker: "Opinion of the Court (Sotomayor, J.)",
        quote:
          "Courts are not required to provide lengthy analyses in support of their damages findings but they are required under Fed.R.Civ.P. 52(a) to “adequately explain the subsidiary facts and methodology underlying the ultimate finding.” Davis v. N.Y. City Hous. Auth., 166 F.3d 432, 436 (2d Cir.1999).",
        fixture: "henry-8409969.txt",
      },
      {
        kind: "reasoning",
        reporterPage: "622",
        speaker: "Opinion of the Court (Sotomayor, J.)",
        quote:
          "The district court’s determination that CommutAir was valued at $145 million at the time of the ESOP transaction was not accompanied by any explanation of the facts or methodology used to reach this figure. In the absence of a specific explanation for the district court’s findings, we are unable to determine whether this valuation, and the resulting damages award, are justified.",
        fixture: "henry-8409969.txt",
      },
      {
        kind: "disposition",
        reporterPage: "624",
        speaker: "Opinion of the Court (Sotomayor, J.)",
        quote:
          "For the reasons stated above, we vacate the district court’s judgment and damages award and remand the case to the district court for further proceedings consistent with this opinion.",
        fixture: "henry-8409969.txt",
      },
    ],
  },
  disorbo: {
    id: "disorbo",
    caseName: "DiSorbo v. Hoy",
    citation: "343 F.3d 172 (2d Cir. 2003)",
    court: "Second Circuit",
    decidedAt: "2003-08-29",
    author: "Katzmann, Circuit Judge, for the panel.",
    url: "https://www.courtlistener.com/opinion/8437760/disorbo-v-hoy/",
    topics: ["Damages", "Comparable awards"],
    connection:
      "Gonzalez cites DiSorbo for adjusting comparable awards for inflation, but declines to require a district court to say explicitly that it did so.",
    gonzalez: {
      page: 33,
      quote:
        "To be sure, we have noted that “we must take into account inflation” when assessing comparable cases to determine a reasonable range of compensatory damages, DiSorbo v. Hoy, 343 F.3d 172, 185 (2d Cir. 2003), and a district court should certainly do the same.",
    },
    passages: [
      {
        kind: "reasoning",
        reporterPage: "183",
        speaker: "Opinion of the Court (Katzmann, J.)",
        quote:
          "Our determination of whether a compensatory damages award is excessive should not be conducted “in a vacuum,” but instead “should include consideration of the amounts awarded in other, comparable cases.” Id. (quotations omitted); see also Ismail v. Cohen, 899 F.2d 183, 187 (2d Cir.1990).",
        fixture: "disorbo-8408210.txt",
      },
      {
        kind: "relied_on",
        reporterPage: "185",
        speaker: "Opinion of the Court (Katzmann, J.)",
        quote:
          "In addition, when considering the sizes of the awards in earlier cases, we must take into account inflation, as the reasonable range for Rebecca DiSorbo’s injuries today is higher than what it would have been ten years ago. Even so, our caselaw simply does not allow for a $400,000 compensatory damages award for Rebecca DiSorbo’s injuries.",
        fixture: "disorbo-8408210.txt",
      },
      {
        kind: "disposition",
        reporterPage: "189",
        speaker: "Opinion of the Court (Katzmann, J.)",
        quote:
          "Unless Rebecca DiSorbo agrees to accept $250,000 in compensatory damages and $75,000 in punitive damages, which would entail remitting $150,000 of the compensatory damages award and $1.2 million of the punitive damages award, we order a new trial on damages.",
        fixture: "disorbo-8408210.txt",
      },
    ],
  },
};
