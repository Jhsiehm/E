/** Shared launch defaults for the agent catalog (catalog.ts). */
import type { AgentConfig, PracticeAreaKey, ReadinessEvidence } from "./types";

export const NO_EVIDENCE: ReadinessEvidence = {
  goldenQuestions: 0,
  adversarialCases: 0,
  lastEvalPassedAt: null,
  inventedCitationsAccepted: 0,
  attorneySignoff: null,
  corpusConfirmed: false,
};

export const VERIFY = {
  sourceExists: true,
  quoteMatches: true,
  claimSupport: true,
  treatmentStatus: "coverage_dependent",
  humanReviewRequired: true,
} as const;

export const TIERS = {
  plan: "reasoning",
  rerank: "fast",
  draft: "frontier",
  verify: "reasoning",
} as const;

export const RESEARCH_OUTPUT = {
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

export const RETRIEVAL = {
  maxCandidates: 60,
  maxReranked: 12,
  maxPrivateDocumentVersions: 15,
  publicPrivateMix: "query_dependent",
} as const;

export const BUDGETS = {
  maxUSDPerRun: 1.5,
  maxSourceTokens: 18_000,
  maxOutputTokens: 2_500,
};

export const ALL_TOOLS = [
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

export const NY_FEDERAL = [
  "NY",
  "2d-cir",
  "sdny",
  "edny",
  "ndny",
  "wdny",
] as const;
export const NY_SOURCES = [
  "ny_state_opinions",
  // No provider yet (no API, rights review pending); never confirms.
  "ny_official_reports",
  "federal_opinions_licensed",
  "ny_legislation",
] as const;

/** A card that exists in the catalog but cannot run yet. */
export function comingLater(
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
