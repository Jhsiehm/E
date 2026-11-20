import type { Doc, Matter } from "./types";
import { COURT_RECORDS } from "@/lib/demo/court-records";

/**
 * The public-court-record demo matter: Gonzalez v. United States (2d Cir.
 * 2023). Built only from the bundled opinion; no client, counsel, deadline
 * or development is invented. Its documents are the bundled public PDFs,
 * never files in private storage.
 */
export const GONZALEZ_MATTER_ID = "gonzalez";

const summary = `Public court record used for this demonstration. Casevex does not represent any party, and no client information is involved.

Case overview
Miriam Gonzalez, individually and as executrix of the estate of her husband, Robert R. Salazar, sued the United States under the Federal Tort Claims Act. She alleged that a U.S. Department of Veterans Affairs hospital negligently failed to diagnose Mr. Salazar’s lung cancer between October 2015 and August 2016. Before trial, the government conceded that the ten-month failure to diagnose was a departure from the standard of care. After a two-day bench trial, the district court (Daniels, J.) awarded $975,233.75 in damages, including $850,000 for pain and suffering and $50,000 for loss of consortium.

The appeal
Gonzalez argued that the district court did not adequately explain its damages findings, as Federal Rule of Civil Procedure 52(a) requires, and that the awards were inadequate in light of comparable New York cases. The Second Circuit (Chin, Sullivan and Bianco, Circuit Judges; opinion by Judge Bianco) held that an FTCA damages award governed by New York law is reviewed under the “deviates materially” standard of CPLR § 5501(c), not the federal “shocks the conscience” standard. It found the district court’s explanation sufficient and affirmed both awards.

The partial dissent
Judge Sullivan joined the holding on the standard of review and the loss-of-consortium award. He would have vacated the pain-and-suffering award and remanded for a fuller explanation. The dissent is not controlling law.

Sources: the opinion summary on PDF pages 1–2 and the opinions themselves. Subsequent treatment of this decision has not been checked.`;

export const gonzalezMatter = (): Matter => ({
  id: GONZALEZ_MATTER_ID,
  name: "Gonzalez v. United States",
  docket: COURT_RECORDS.gonzalez.docket,
  court: "2d Cir.",
  type: "Civil litigation · Federal Tort Claims Act",
  status: "decided",
  role: "Not a client matter",
  summary,
  assignedAgentId: "civil",
  documentCount: 2,
  updatedAt: COURT_RECORDS.gonzalez.decidedAt,
  sample: true,
  publicRecord: true,
});

export const gonzalezDocuments = (): Doc[] =>
  (["gonzalez", "malmberg"] as const).map((id) => {
    const r = COURT_RECORDS[id];
    return {
      id: `court-record-${id}`,
      matterId: GONZALEZ_MATTER_ID,
      name: `${r.caseName} (${r.decided})`,
      ext: "pdf",
      sizeBytes: r.sizeBytes,
      type: id === "gonzalez" ? "Primary authority" : "Supporting precedent",
      ownerInitials: "CR",
      modifiedAt: r.decidedAt,
      status: "public_record",
      sha256: r.sha256,
      publicUrl: r.publicPath,
    };
  });
