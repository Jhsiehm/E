import {
  agentForPracticeArea,
  statusForPracticeArea,
  type AgentStatus,
  type PracticeAreaKey,
} from "@/lib/agents";
export type Matter = {
  id: string;
  name: string;
  docket: string;
  court: string;
  type: string;
  status: string;
  role: string;
  summary: string;
  assignedAgentId: string;
  documentCount: number;
  updatedAt: string;
};
export type Doc = {
  id: string;
  matterId: string;
  name: string;
  ext: string;
  sizeBytes: number;
  type: string;
  ownerInitials: string;
  modifiedAt: string;
  status: string;
};
export type Deadline = {
  id: string;
  matterId: string;
  title: string;
  dueAt: string;
  kind: string;
};
export type Notice = {
  id: string;
  kind: string;
  title: string;
  source: string;
  detail: string;
  read: boolean;
  matterIds: string[];
  createdAt: string;
};
export type Source = {
  index: number;
  title: string;
  meta: string;
  href: string;
  verified: boolean;
};
export type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  sources?: Source[];
};
export type Agent = {
  id: string;
  name: string;
  practiceArea: string;
  description: string;
  matterCount: number;
  /** available | beta | coming_later, from lib/agents. */
  availability: AgentStatus;
  practiceAreaKey: PracticeAreaKey;
};
export type Precedent = {
  id: string;
  caseName: string;
  citation: string;
  court: string;
  decidedAt: string;
  topics: string[];
  holding: string;
  verified: boolean;
  isSample?: boolean;
};
export type State = {
  me: {
    name: string;
    role: string;
    email: string;
    theme: string;
    defaultPracticeArea: string;
    timeZone: string;
  };
  matters: Matter[];
  documents: Doc[];
  deadlines: Deadline[];
  notices: Notice[];
  agents: Agent[];
  precedents: Precedent[];
  chats: Record<string, Message[]>;
  strategies: Record<string, string>;
};
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
export function seed(): State {
  return {
    me: {
      name: "Jordan Wells",
      role: "Partner",
      email: "jordan.wells@example.com",
      theme: "light",
      defaultPracticeArea: "Civil litigation",
      timeZone: "America/New_York",
    },
    matters: [
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
    ],
    deadlines: [
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
    })),
    documents: [
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
      modifiedAt: `2026-11-${11 - i}`,
    })),
    notices: [
      {
        id: "n1",
        kind: "ruling",
        title: "Second Circuit narrows trade secret standard",
        source: "U.S. v. Nexora Tech · 2d Cir. · Fictional sample",
        detail:
          "Sample impact analysis: strengthens Anderson; weakens Ridgeway. Review the opinion before relying on this analysis.",
        read: false,
        matterIds: ["anderson", "ridgeway"],
        createdAt: "2026-11-11T15:00:00Z",
      },
      {
        id: "n2",
        kind: "ruling",
        title: "Supreme Court issues arbitration ruling",
        source: "U.S. Sup. Ct. · Fictional sample",
        detail:
          "A sample arbitration notice for review. No real ruling is represented.",
        read: false,
        matterIds: ["ridgeway"],
        createdAt: "2026-11-11T13:00:00Z",
      },
      {
        id: "n3",
        kind: "deadline",
        title: "Response to motion due in 7 days",
        source: "Ridgeway Holdings LLC",
        detail: "Response to motion is due November 18, 2026.",
        read: false,
        matterIds: ["ridgeway"],
        createdAt: "2026-11-11T12:00:00Z",
      },
      {
        id: "n4",
        kind: "docket",
        title: "Docket update: order on motion to compel",
        source: "S.D.N.Y. · Anderson v. Meridian Tech",
        detail:
          "Sample docket activity. Review the order with the assigned team.",
        read: true,
        matterIds: ["anderson"],
        createdAt: "2026-11-10T12:00:00Z",
      },
      {
        id: "n5",
        kind: "deadline",
        title: "Document production reminder",
        source: "Parker Estates Trust",
        detail: "Document production is due November 24, 2026.",
        read: true,
        matterIds: ["parker"],
        createdAt: "2026-11-09T12:00:00Z",
      },
    ],
    // Readiness comes from the agent catalog (lib/agents), never hard-coded.
    agents: (
      [
        ["consumer", "consumer_class_action", 0],
        ["civil", "ny_civil_litigation", 12],
        ["corporate", "corporate", 8],
        ["trust", "trust_estate", 5],
        ["regulatory", "regulatory", 6],
        ["international", "international", 4],
        ["contract", "contracts", 11],
      ] as const
    ).map(([id, key, matterCount]) => {
      const agent = agentForPracticeArea(key)!;
      return {
        id,
        name: agent.displayName,
        practiceArea: agent.displayName,
        practiceAreaKey: key,
        matterCount,
        description: agent.description,
        availability: statusForPracticeArea(key),
      };
    }),
    // Real citations below must be verified before use. All verification badges in this prototype are simulated.
    precedents: [
      {
        id: "carpenter",
        caseName: "Carpenter v. United States",
        citation: "585 U.S. 296 (2018)",
        court: "U.S. Supreme Court",
        decidedAt: "2018-06-22",
        topics: ["Privacy", "Fourth Amendment"],
        holding:
          "Research note: review the opinion for the treatment of historical cell-site location records. This is a sample summary, not a verified legal holding.",
        verified: true,
      },
      {
        id: "mantikas",
        caseName: "Mantikas v. Kellogg Co.",
        citation: "910 F.3d 633 (2d Cir. 2018)",
        court: "Second Circuit",
        decidedAt: "2018-12-11",
        topics: ["Consumer protection", "Class action"],
        holding:
          "Research note: examine the opinion’s treatment of front-label representations and reasonable consumer expectations. Verify before use.",
        verified: true,
      },
      {
        id: "meyer",
        caseName: "Meyer v. Uber Technologies, Inc.",
        citation: "868 F.3d 66 (2d Cir. 2017)",
        court: "Second Circuit",
        decidedAt: "2017-08-17",
        topics: ["Arbitration", "Contracts"],
        holding:
          "Research note: examine notice and assent in the electronic contracting process. Verify before use.",
        verified: true,
      },
      {
        id: "nexora",
        caseName: "U.S. v. Nexora Tech",
        citation: "138 F.4th 427 (2d Cir. 2026)",
        court: "Second Circuit",
        decidedAt: "2026-11-11",
        topics: ["Trade secrets", "Confidentiality"],
        holding:
          "Fictional sample: the court adopts a broad reading of confidential information. This case and citation are invented for the prototype.",
        verified: true,
        isSample: true,
      },
    ],
    chats: {
      anderson: [
        {
          id: "msg1",
          role: "user",
          text: "Does the new ruling help our case, and what should we do next?",
        },
        { id: "msg2", role: "agent", text: sampleAnswer, sources },
      ],
    },
    strategies: {},
  };
}
