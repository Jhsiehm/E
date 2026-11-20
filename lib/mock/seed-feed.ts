import { agentForPracticeArea, statusForPracticeArea } from "@/lib/agents";
import { sampleAnswer, sources } from "./samples";
import type { Agent, Message, Notice, Precedent } from "./types";
import { COURT_RECORDS, type CourtRecordId } from "@/lib/demo/court-records";
import { CONNECTED, type ConnectedId } from "@/lib/demo/connected-authorities";

/** Sample notices, agents, precedents and chats. Fresh copies per call. */

export const seedNotices = (): Notice[] => [
  {
    id: "n1",
    kind: "ruling",
    title: "Second Circuit broadens confidential-information standard",
    source: "U.S. v. Nexora Tech · 2d Cir. · Fictional sample",
    detail:
      "Sample impact analysis: strengthens Anderson; weakens Ridgeway. Review the opinion before relying on this analysis.",
    summary:
      "Review the trade-secret ruling, then update Anderson’s supporting argument and Ridgeway’s risk analysis.",
    caseUpdates: [
      {
        matterId: "anderson",
        impact:
          "This fictional ruling may support Anderson’s confidentiality argument.",
        nextStep:
          "Compare the declaration with the sample ruling, then revise the trade-secret argument in the strategy notes. Flag the draft motion for attorney review.",
        target: "strategy",
      },
      {
        matterId: "ridgeway",
        impact:
          "The broader standard may increase exposure under Ridgeway’s sample facts.",
        nextStep:
          "Document factual distinctions and defenses in the strategy notes, and flag the relevant contract language for review.",
        target: "strategy",
      },
    ],
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
    summary:
      "Check Ridgeway’s arbitration clause and note whether the pending motion’s argument needs revision.",
    caseUpdates: [
      {
        matterId: "ridgeway",
        impact:
          "The sample notice raises questions about the contract’s arbitration provision.",
        nextStep:
          "Review the contract’s notice and assent language, then record whether the pending motion needs a revised arbitration argument.",
        target: "strategy",
      },
    ],
    read: false,
    matterIds: ["ridgeway"],
    createdAt: "2026-11-11T13:00:00Z",
  },
  {
    id: "n-gonzalez",
    kind: "ruling",
    title:
      "Second Circuit sets the standard for FTCA damages under New York law",
    source: "Gonzalez v. United States · 2d Cir. · Public court record",
    detail:
      "Public court record, decided August 24, 2023. The court held that an FTCA pain-and-suffering award governed by New York law is reviewed under the “deviates materially” standard of CPLR § 5501(c). The holding is quoted from the bundled opinion, PDF page 23. Subsequent treatment has not been checked.",
    summary:
      "Read the holding in the original opinion, then compare the majority and the partial dissent on the $850,000 award.",
    caseUpdates: [
      {
        matterId: "gonzalez",
        impact:
          "This is the decision itself, attached to the demonstration matter. No client matter is affected.",
        nextStep:
          "Open the opinion at page 23 from the matter’s documents, then review the prepared comparison of the majority and the partial dissent.",
        target: "documents",
      },
    ],
    read: true,
    matterIds: ["gonzalez"],
    createdAt: "2023-08-24T16:00:00Z",
  },
  {
    id: "n3",
    kind: "deadline",
    title: "Response to motion due in 7 days",
    source: "Ridgeway Holdings LLC",
    detail: "Response to motion is due November 18, 2026.",
    summary:
      "Confirm Ridgeway’s response deadline, assign a drafting owner, and set an internal review date.",
    caseUpdates: [
      {
        matterId: "ridgeway",
        impact: "Ridgeway’s sample response date is approaching.",
        nextStep:
          "Confirm the November 18 deadline, assign a drafting owner, and record the internal review date in the case calendar.",
        target: "deadlines",
      },
    ],
    read: false,
    matterIds: ["ridgeway"],
    createdAt: "2026-11-11T12:00:00Z",
  },
  {
    id: "n4",
    kind: "docket",
    title: "Docket update: order on motion to compel",
    source: "S.D.N.Y. · Anderson v. Meridian Tech",
    detail: "Sample docket activity. Review the order with the assigned team.",
    summary:
      "Add Anderson’s new order to the case documents and review its production requirements with the team.",
    caseUpdates: [
      {
        matterId: "anderson",
        impact: "The sample docket includes an order on the motion to compel.",
        nextStep:
          "Add the order to the case documents and record its production requirements for team review before changing any deadlines.",
        target: "documents",
      },
    ],
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
    summary:
      "Check Parker’s outstanding documents and confirm the production and review dates.",
    caseUpdates: [
      {
        matterId: "parker",
        impact:
          "The sample trust matter has a document production deadline on November 24.",
        nextStep:
          "Check which documents are still outstanding, confirm the production date, and record the team’s review milestone.",
        target: "deadlines",
      },
    ],
    read: true,
    matterIds: ["parker"],
    createdAt: "2026-11-09T12:00:00Z",
  },
];

// Readiness comes from the agent catalog (lib/agents), never hard-coded.
export const seedAgents = (): Agent[] =>
  (
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
  });

/**
 * Real authorities are drawn from the bundled public opinions
 * (lib/demo/court-records.ts): each holding is quoted from the file, on the
 * page given, and checked by tests/unit/court-records.test.ts.
 */
const TOPICS: Record<CourtRecordId, string[]> = {
  gonzalez: ["Damages", "Federal Tort Claims Act"],
  malmberg: ["Damages", "Federal Tort Claims Act"],
  carpenter: ["Privacy", "Fourth Amendment"],
  mantikas: ["Consumer protection", "Class action"],
  meyer: ["Arbitration", "Contracts"],
};

const realPrecedent = (id: CourtRecordId): Precedent => {
  const r = COURT_RECORDS[id];
  return {
    id,
    caseName: r.caseName,
    citation: r.citation,
    court:
      r.court === "Supreme Court of the United States"
        ? "U.S. Supreme Court"
        : "Second Circuit",
    decidedAt: r.decidedAt,
    topics: TOPICS[id],
    holding: r.holding?.quote ?? "",
    verified: false,
    record: id,
  };
};

const connectedPrecedent = (id: ConnectedId): Precedent => {
  const a = CONNECTED[id];
  return {
    id,
    caseName: a.caseName,
    citation: a.citation,
    court: a.court,
    decidedAt: a.decidedAt,
    topics: a.topics,
    holding: a.connection,
    verified: false,
    authority: id,
  };
};

export const seedPrecedents = (): Precedent[] => [
  ...(["gonzalez", "malmberg", "carpenter", "mantikas", "meyer"] as const).map(
    realPrecedent,
  ),
  ...(["gasperini", "henry", "disorbo"] as const).map(connectedPrecedent),
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
];

export const seedChats = (): Record<string, Message[]> => ({
  anderson: [
    {
      id: "msg1",
      role: "user",
      text: "Does the new ruling help our case, and what should we do next?",
    },
    { id: "msg2", role: "agent", text: sampleAnswer, sources },
  ],
});
