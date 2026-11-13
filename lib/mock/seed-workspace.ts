import type { Deadline, Doc, Matter } from "./types";

/** Sample matters, deadlines and documents. Fresh copies per call. */

export const seedMatters = (): Matter[] => [
  {
    id: "anderson",
    name: "Anderson v. Meridian Tech",
    docket: "No. 1:26-cv-01428",
    court: "S.D.N.Y.",
    type: "Civil litigation",
    status: "active",
    role: "Plaintiff",
    summary:
      "Breach of contract and misappropriation of confidential information against Meridian Tech.",
    assignedAgentId: "civil",
    documentCount: 24,
    updatedAt: "2026-11-11",
  },
  {
    id: "parker",
    name: "Parker Estates Trust",
    docket: "File No. 2026-EP-1189",
    court: "N.Y. Sur. Ct.",
    type: "Trust and estate",
    status: "active",
    role: "Other",
    summary:
      "Administration of the Parker family trust and review of the proposed trust amendment.",
    assignedAgentId: "trust",
    documentCount: 12,
    updatedAt: "2026-11-10",
  },
  {
    id: "ridgeway",
    name: "Ridgeway Holdings LLC",
    docket: "No. 1:26-cv-00982",
    court: "D. Del.",
    type: "Corporate",
    status: "in_review",
    role: "Defendant",
    summary:
      "Corporate dispute concerning confidential information and contractual obligations.",
    assignedAgentId: "corporate",
    documentCount: 18,
    updatedAt: "2026-11-10",
  },
  {
    id: "diaz",
    name: "Diaz v. City of Brookfield",
    docket: "No. 3:26-cv-00871",
    court: "D. Conn.",
    type: "Civil rights",
    status: "active",
    role: "Plaintiff",
    summary:
      "Civil rights litigation involving municipal policies and individual claims.",
    assignedAgentId: "civil",
    documentCount: 9,
    updatedAt: "2026-11-09",
  },
  {
    id: "elmwood",
    name: "Elmwood Employment Matter",
    docket: "No. 1:25-cv-01913",
    court: "S.D.N.Y.",
    type: "Employment",
    status: "archived",
    role: "Plaintiff",
    summary:
      "Archived employment dispute. The matter is retained for reference.",
    assignedAgentId: "contract",
    documentCount: 15,
    updatedAt: "2026-11-05",
  },
];

export const seedDeadlines = (): Deadline[] =>
  [
    ["d1", "ridgeway", "Response to motion", "2026-11-18", "deadline"],
    ["d2", "parker", "Document production", "2026-11-24", "deadline"],
    [
      "d3",
      "anderson",
      "Opposition to motion for summary judgment",
      "2026-12-02",
      "deadline",
    ],
    ["d4", "anderson", "Meet and confer", "2026-12-16", "meeting"],
    ["d5", "anderson", "Pretrial conference", "2027-01-08", "hearing"],
  ].map(([id, matterId, title, dueAt, kind]) => ({
    id,
    matterId,
    title,
    dueAt,
    kind,
  }));

export const seedDocuments = (): Doc[] =>
  [
    [
      "doc1",
      "anderson",
      "Motion to compel (draft)",
      "docx",
      845000,
      "Motion",
      "draft",
    ],
    [
      "doc2",
      "anderson",
      "Trade secret declaration",
      "pdf",
      2400000,
      "Declaration",
      "final",
    ],
    [
      "doc3",
      "ridgeway",
      "Deposition transcript",
      "pdf",
      3800000,
      "Transcript",
      "final",
    ],
    [
      "doc4",
      "parker",
      "Trust amendment (draft)",
      "docx",
      620000,
      "Agreement",
      "in_review",
    ],
    [
      "doc5",
      "anderson",
      "Complaint (filed)",
      "pdf",
      1200000,
      "Pleading",
      "final",
    ],
  ].map((r, i) => ({
    id: String(r[0]),
    matterId: String(r[1]),
    name: String(r[2]),
    ext: String(r[3]),
    sizeBytes: Number(r[4]),
    type: String(r[5]),
    status: String(r[6]),
    ownerInitials: "JW",
    modifiedAt: `2026-11-${String(11 - i).padStart(2, "0")}`,
  }));
