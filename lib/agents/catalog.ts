import type {
  AgentConfig,
  AgentStatus,
  PracticeAreaKey,
  ReadinessEvidence,
} from "./types";

/**
 * Built-in agent templates (spec 04 agent_definitions, launch defaults).
 *
 * These are illustrative launch defaults, bounded by validateAgentConfig.
 * Source collection names are configuration, not proof of licensed access;
 * the retrieval adapters (P3) decide what is actually searchable.
 */

const NO_EVIDENCE: ReadinessEvidence = {
  goldenQuestions: 0,
  adversarialCases: 0,
  lastEvalPassedAt: null,
  inventedCitationsAccepted: 0,
  attorneySignoff: null,
  corpusConfirmed: false,
};

const VERIFY = {
  sourceExists: true,
  quoteMatches: true,
  claimSupport: true,
  treatmentStatus: "coverage_dependent",
  humanReviewRequired: true,
} as const;

const TIERS = {
  plan: "reasoning",
  rerank: "fast",
  draft: "frontier",
  verify: "reasoning",
} as const;

const RESEARCH_OUTPUT = {
  sections: [
    "short_answer",
    "reasoning",
    "contrary_authorities",
    "risks",
    "next_steps",
    "sources",
  ],
  pinpointRequired: true,
} as const;

const RETRIEVAL = {
  maxCandidates: 60,
  maxReranked: 12,
  maxPrivateDocumentVersions: 15,
  publicPrivateMix: "query_dependent",
} as const;

const BUDGETS = {
  maxUSDPerRun: 1.5,
  maxSourceTokens: 18_000,
  maxOutputTokens: 2_500,
};

const ALL_TOOLS = [
  "search_law",
  "read_matter_documents",
  "cite_check",
  "compare_authorities",
  "draft_memo",
  "draft_motion_outline",
  "draft_client_letter",
  "build_chronology",
  "suggest_watch",
  "save_to_matter",
] as const;

const NY_FEDERAL = ["NY", "2d-cir", "sdny", "edny", "ndny", "wdny"] as const;
const NY_SOURCES = [
  "ny_official_reports",
  "federal_opinions_licensed",
  "ny_legislation",
] as const;

/** A card that exists in the catalog but cannot run yet. */
function comingLater(
  key: string,
  practiceArea: PracticeAreaKey,
  displayName: string,
  description: string,
): AgentConfig {
  return {
    key,
    version: 1,
    displayName,
    description,
    practiceArea,
    requestedStatus: "coming_later",
    supportedJurisdictions: [],
    sourceCollectionAllowlist: [],
    workflows: [],
    tools: [],
    playbooks: [],
    retrieval: { ...RETRIEVAL, publicPrivateMix: "public_only" },
    output: RESEARCH_OUTPUT,
    verification: VERIFY,
    tiers: TIERS,
    budgets: BUDGETS,
    monitoring: { suggestWatches: false, autostartWatches: false },
    readiness: NO_EVIDENCE,
  };
}

export const AGENT_CATALOG: readonly AgentConfig[] = [
  {
    key: "ny_consumer_class",
    version: 1,
    displayName: "Consumer protection and class actions",
    description:
      "Deceptive practices, false advertising and class actions in New York state and federal courts.",
    practiceArea: "consumer_class_action",
    requestedStatus: "available",
    supportedJurisdictions: NY_FEDERAL,
    sourceCollectionAllowlist: NY_SOURCES,
    workflows: [
      "legal_issue_research",
      "precedent_comparison",
      "motion_research",
      "document_question_answer",
      "monitoring_suggestion",
    ],
    tools: ALL_TOOLS,
    playbooks: [
      {
        key: "ny_gbl_349_350",
        label: "NY GBL 349 and 350 deceptive practices",
        issueChecklist: [
          "Consumer-oriented conduct",
          "Materially misleading act or advertisement",
          "Injury caused by the act",
          "Reasonable consumer standard",
          "Statute of limitations",
          "Contrary authority in this court",
        ],
        preferredSources: ["ny_official_reports", "ny_legislation"],
        status: "beta",
      },
      {
        key: "class_certification",
        label: "Class certification",
        issueChecklist: [
          "Numerosity, commonality, typicality, adequacy",
          "Predominance and superiority",
          "Ascertainability in this circuit",
          "Damages model",
          "Contrary authority in this court",
        ],
        preferredSources: ["federal_opinions_licensed"],
        status: "beta",
      },
      {
        key: "arbitration_clauses",
        label: "Arbitration clauses and class waivers",
        issueChecklist: [
          "Formation: notice and assent",
          "Scope of the clause",
          "Delegation clause",
          "Class waiver enforceability",
          "Unconscionability defenses",
        ],
        preferredSources: ["federal_opinions_licensed", "ny_official_reports"],
        status: "beta",
      },
    ],
    retrieval: RETRIEVAL,
    output: RESEARCH_OUTPUT,
    verification: VERIFY,
    tiers: TIERS,
    budgets: BUDGETS,
    monitoring: { suggestWatches: true, autostartWatches: false },
    readiness: NO_EVIDENCE,
  },
  {
    key: "ny_civil",
    version: 1,
    displayName: "Civil litigation",
    description:
      "Motions, pleadings, procedure and standards of review in New York state and federal courts.",
    practiceArea: "ny_civil_litigation",
    requestedStatus: "available",
    supportedJurisdictions: NY_FEDERAL,
    sourceCollectionAllowlist: NY_SOURCES,
    workflows: [
      "legal_issue_research",
      "precedent_comparison",
      "motion_research",
      "document_question_answer",
      "monitoring_suggestion",
    ],
    tools: ALL_TOOLS,
    playbooks: [
      {
        key: "motion_to_dismiss",
        label: "Motions to dismiss",
        issueChecklist: [
          "Governing standard (CPLR 3211 or FRCP 12(b))",
          "Burden on each side",
          "Documentary evidence allowed",
          "Leave to amend",
          "Contrary authority in this court",
        ],
        preferredSources: ["ny_official_reports", "federal_opinions_licensed"],
        status: "beta",
      },
      {
        key: "summary_judgment",
        label: "Summary judgment",
        issueChecklist: [
          "Standard (CPLR 3212 or FRCP 56)",
          "Material facts in dispute, with record cites",
          "Admissible evidence",
          "Contrary authority in this court",
        ],
        preferredSources: ["ny_official_reports", "federal_opinions_licensed"],
        status: "beta",
      },
    ],
    retrieval: RETRIEVAL,
    output: RESEARCH_OUTPUT,
    verification: VERIFY,
    tiers: TIERS,
    budgets: BUDGETS,
    monitoring: { suggestWatches: true, autostartWatches: false },
    readiness: NO_EVIDENCE,
  },
  {
    key: "ny_employment",
    version: 1,
    displayName: "Employment",
    description:
      "Discrimination, wage and retaliation questions, with agency guidance kept separate from case law.",
    practiceArea: "employment",
    requestedStatus: "beta",
    supportedJurisdictions: NY_FEDERAL,
    sourceCollectionAllowlist: NY_SOURCES,
    workflows: ["legal_issue_research", "document_question_answer"],
    tools: [
      "search_law",
      "read_matter_documents",
      "cite_check",
      "draft_memo",
      "save_to_matter",
    ],
    playbooks: [],
    retrieval: RETRIEVAL,
    output: RESEARCH_OUTPUT,
    verification: VERIFY,
    tiers: TIERS,
    budgets: BUDGETS,
    monitoring: { suggestWatches: false, autostartWatches: false },
    readiness: NO_EVIDENCE,
  },
  comingLater(
    "contracts",
    "contracts",
    "Contracts",
    "Contract review and drafting support.",
  ),
  comingLater(
    "corporate",
    "corporate",
    "Corporate",
    "Corporate and transactional matters.",
  ),
  comingLater(
    "trust_estate",
    "trust_estate",
    "Trust and estate",
    "Trusts, estates and probate.",
  ),
  comingLater(
    "regulatory",
    "regulatory",
    "Regulatory",
    "Agency rules and regulatory compliance.",
  ),
  comingLater(
    "real_estate",
    "real_estate",
    "Real estate",
    "Leases, title and property disputes.",
  ),
  comingLater(
    "international",
    "international",
    "International",
    "Cross-border matters.",
  ),
];

/**
 * True when a niche has earned "available": its golden set passed with zero
 * invented citations and an attorney signed off (spec 04 quality gates:
 * >= 60 golden questions and >= 30 adversarial cases).
 */
export function hasReadinessEvidence(e: ReadinessEvidence): boolean {
  return (
    e.corpusConfirmed &&
    e.goldenQuestions >= 60 &&
    e.adversarialCases >= 30 &&
    e.lastEvalPassedAt !== null &&
    e.inventedCitationsAccepted === 0 &&
    e.attorneySignoff !== null
  );
}

/**
 * What the Agents screen shows. "available" is never taken on trust: without
 * evidence it drops to beta. Until attorney reviewers exist, nothing is
 * available (Joshua, 2026-11-12: focus on development first).
 */
export function effectiveStatus(agent: AgentConfig): AgentStatus {
  if (agent.requestedStatus === "coming_later") return "coming_later";
  if (
    agent.requestedStatus === "available" &&
    hasReadinessEvidence(agent.readiness)
  )
    return "available";
  return "beta";
}

export function agentForPracticeArea(
  key: PracticeAreaKey,
): AgentConfig | undefined {
  return AGENT_CATALOG.find((a) => a.practiceArea === key);
}

export function statusForPracticeArea(key: PracticeAreaKey): AgentStatus {
  const agent = agentForPracticeArea(key);
  return agent ? effectiveStatus(agent) : "coming_later";
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  available: "Available",
  beta: "Beta",
  coming_later: "Coming later",
};
