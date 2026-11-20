/**
 * Public court records bundled with the public demo.
 *
 * Each PDF is the court's slip opinion, downloaded unchanged from the source
 * URL below and stored under public/court-records/ with its original file
 * name. Judicial opinions are public records and are not subject to
 * copyright. The sha256 pins the exact file every quotation and page number
 * was read from; tests/unit/court-records.test.ts checks both against the
 * bundled files.
 *
 * These files are served as static, read-only public assets. They are never
 * stored in, or read through, the private document storage used by real
 * accounts.
 */
export type CourtRecordId =
  "gonzalez" | "malmberg" | "carpenter" | "mantikas" | "meyer";

/** An exact passage from a bundled record, with where to find it. */
export interface Pinpoint {
  /** 1-based page in the bundled PDF. */
  page: number;
  /** Page number printed on that page, when it differs. */
  printedPage?: string;
  /** Exact wording from the PDF (line breaks and hyphenation joined). */
  quote: string;
}

export interface CourtRecord {
  id: CourtRecordId;
  caseName: string;
  /** Reported citation, as supplied with the source. Not checked against the reporter. */
  citation: string;
  docket: string;
  court: string;
  decided: string;
  /** ISO date of decision. */
  decidedAt: string;
  /** Judges and authors as printed in the opinion. */
  panel: string;
  /** Original file name, as published by the source. */
  fileName: string;
  /** Path of the bundled, public, read-only copy. */
  publicPath: string;
  /** Where the file was downloaded from. */
  sourceUrl: string;
  sourceName: string;
  sha256: string;
  sizeBytes: number;
  pages: number;
  /** The holding, quoted from the opinion, for the precedent library. */
  holding?: Pinpoint;
  /** A note on this copy of the file, when one is needed. */
  note?: string;
}

export const COURT_RECORDS: Record<CourtRecordId, CourtRecord> = {
  gonzalez: {
    id: "gonzalez",
    caseName: "Gonzalez v. United States",
    citation: "80 F.4th 183 (2d Cir. 2023)",
    docket: "No. 21-548-cv",
    court: "U.S. Court of Appeals for the Second Circuit",
    decided: "August 24, 2023",
    decidedAt: "2023-08-24",
    panel:
      "Chin, Sullivan and Bianco, Circuit Judges. Opinion by Judge Bianco; Judge Sullivan concurring in part and dissenting in part.",
    fileName: "21-548-2023-08-24.pdf",
    publicPath: "/court-records/21-548-2023-08-24.pdf",
    sourceUrl:
      "https://cases.justia.com/federal/appellate-courts/ca2/21-548/21-548-2023-08-24.pdf?ts=1692887435",
    sourceName: "Justia (court slip opinion)",
    sha256: "0593aa70a7dede5efeecc64e41d4cf38f9e076d56d62c2d29f3281bdb1522580",
    sizeBytes: 427744,
    pages: 54,
    holding: {
      page: 23,
      quote:
        "Therefore, we hold that “where the nature and measure of damages is governed by New York law,” Malmberg, 816 F.3d at 199, a pain-and-suffering award arising out of the FTCA should be set aside if it “deviates materially from what would be reasonable compensation,” CPLR § 5501(c).",
    },
  },
  malmberg: {
    id: "malmberg",
    caseName: "Malmberg v. United States",
    citation: "816 F.3d 185 (2d Cir. 2016)",
    docket: "Nos. 14-3555-cv(L), 14-3913-cv(XAP)",
    court: "U.S. Court of Appeals for the Second Circuit",
    decided: "March 4, 2016",
    decidedAt: "2016-03-04",
    panel:
      "Cabranes and Pooler, Circuit Judges, and Gardephe, District Judge, sitting by designation.",
    fileName: "14-3555-2016-03-04.pdf",
    publicPath: "/court-records/14-3555-2016-03-04.pdf",
    sourceUrl:
      "https://cases.justia.com/federal/appellate-courts/ca2/14-3555/14-3555-2016-03-04.pdf?ts=1457105405",
    sourceName: "Justia (court slip opinion)",
    sha256: "447a9ae2c7c65e8e89afc1a73f4b8e2e01db7562a2e6de497b6ced55207049e2",
    sizeBytes: 255246,
    pages: 33,
    holding: {
      page: 31,
      quote:
        "Absent further analysis and clearer reasoning by the district court, we cannot make a fair determination about whether the pain and suffering award is inadequate.",
    },
  },
  carpenter: {
    id: "carpenter",
    caseName: "Carpenter v. United States",
    citation: "585 U.S. 296 (2018)",
    docket: "No. 16-402",
    court: "Supreme Court of the United States",
    decided: "June 22, 2018",
    decidedAt: "2018-06-22",
    panel:
      "Roberts, C.J., delivered the opinion of the Court. Kennedy, Thomas, Alito and Gorsuch, JJ., filed dissenting opinions.",
    fileName: "carpenter_v._united_states.pdf",
    publicPath: "/court-records/carpenter_v._united_states.pdf",
    sourceUrl:
      "https://storage.courtlistener.com/pdf/2018/06/22/carpenter_v._united_states.pdf",
    sourceName: "CourtListener (Supreme Court slip opinion)",
    sha256: "957dd4a8a521febb07019e4ccd45b57bb7f92d1df806bc5b786785059e5c03e6",
    sizeBytes: 507715,
    pages: 119,
    holding: {
      page: 26,
      printedPage: "22",
      quote:
        "We decline to grant the state unrestricted access to a wireless carrier’s database of physical location information.",
    },
    note: "Slip opinion; the bound United States Reports version may differ in pagination and minor wording.",
  },
  mantikas: {
    id: "mantikas",
    caseName: "Mantikas v. Kellogg Co.",
    citation: "910 F.3d 633 (2d Cir. 2018)",
    docket: "No. 17-2011",
    court: "U.S. Court of Appeals for the Second Circuit",
    decided: "December 11, 2018",
    decidedAt: "2018-12-11",
    panel: "Leval, Sack and Droney, Circuit Judges. Opinion by Judge Leval.",
    fileName: "17-2011-2018-12-11.pdf",
    publicPath: "/court-records/17-2011-2018-12-11.pdf",
    sourceUrl:
      "https://cases.justia.com/federal/appellate-courts/ca2/17-2011/17-2011-2018-12-11.pdf",
    sourceName: "Justia (court slip opinion)",
    sha256: "0d9c4c673f61836a920f4b12fd297f51032b47c16d3b0eac612f62934f96edfc",
    sizeBytes: 223640,
    pages: 16,
    holding: {
      page: 3,
      quote:
        "We conclude that the district court erred in dismissing Plaintiffs’ complaint. Reviewed under the proper standards for a Rule 12(b)(6) motion, the Complaint plausibly alleged that a reasonable consumer would be misled by Defendant’s whole grain labels to believe that the grain in whole grain Cheez‐Its was predominantly whole grain.",
    },
  },
  meyer: {
    id: "meyer",
    caseName: "Meyer v. Uber Technologies, Inc.",
    citation: "868 F.3d 66 (2d Cir. 2017)",
    docket: "Nos. 16-2750-cv, 16-2752-cv",
    court: "U.S. Court of Appeals for the Second Circuit",
    decided: "August 17, 2017",
    decidedAt: "2017-08-17",
    panel: "Raggi, Chin and Carney, Circuit Judges. Opinion by Judge Chin.",
    fileName: "16-2750-2017-08-17.pdf",
    publicPath: "/court-records/16-2750-2017-08-17.pdf",
    sourceUrl:
      "https://cases.justia.com/federal/appellate-courts/ca2/16-2750/16-2750-2017-08-17.pdf",
    sourceName: "Justia (court slip opinion)",
    sha256: "8c8fa518f1f73b8232c93635b2d97de050ccb0d4ee324304fc340f2d117386b2",
    sizeBytes: 1105343,
    pages: 34,
    holding: {
      page: 28,
      quote:
        "Accordingly, we conclude that the Uber App provided reasonably conspicuous notice of the Terms of Service as a matter of California law and turn to the question of whether Meyer unambiguously manifested his assent to those terms.",
    },
  },
};

/** New York CPLR § 5501(c). Linked, not bundled: quoted only as the opinions quote it. */
export const CPLR_5501 = {
  title: "N.Y. CPLR § 5501(c)",
  sourceUrl: "https://www.nysenate.gov/legislation/laws/CVP/5501",
  sourceName: "New York State Senate, Consolidated Laws",
};

/** Link to the bundled original at a 1-based PDF page. */
export const pageLink = (id: CourtRecordId, page: number) =>
  `${COURT_RECORDS[id].publicPath}#page=${page}`;

/** The court record a demo document is, if any (matched by its pinned file). */
export const courtRecordBySha = (sha256?: string | null) =>
  Object.values(COURT_RECORDS).find((r) => r.sha256 === sha256) ?? null;
