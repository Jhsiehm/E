import { agentForPracticeArea, statusForPracticeArea } from "@/lib/agents";
import { sampleAnswer, sources } from "./samples";
import type { Agent, Message, Notice, Precedent } from "./types";

/** Sample notices, agents, precedents and chats. Fresh copies per call. */

export const seedNotices = (): Notice[] => [
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
    detail: "Sample docket activity. Review the order with the assigned team.",
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

// Real citations below must be verified before use. All verification badges in this prototype are simulated.
export const seedPrecedents = (): Precedent[] => [
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
