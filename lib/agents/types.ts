/**
 * Agent profile types, following docs/handoff/04_RESEARCH_AGENTS.md
 * ("Agents: configuration not standalone actors").
 *
 * An agent is versioned configuration, not a trained model: which sources it
 * may search, which jurisdictions it covers, the issue checklists it works
 * through, the tools it may call and how its output must be laid out.
 * Freshness on precedent comes from retrieval (P3) and monitoring (P5).
 */

/**
 * Practice-area keys. These must match lib/practice-areas.ts from the P1
 * onboarding branch; once that lands, replace this union with its export.
 */
export const PRACTICE_AREA_KEYS = [
  "consumer_class_action",
  "ny_civil_litigation",
  "employment",
  "contracts",
  "corporate",
  "trust_estate",
  "regulatory",
  "real_estate",
  "international",
] as const;
export type PracticeAreaKey = (typeof PRACTICE_AREA_KEYS)[number];

/**
 * Readiness shown on the Agents screen. Same values as the shared
 * practice-area catalog's agentStatus.
 * - available:    passed its niche test set and an attorney signed it off
 * - beta:         runnable, still under evaluation; answers carry a beta label
 * - coming_later: card is shown but cannot be run or assigned
 */
export type AgentStatus = "available" | "beta" | "coming_later";

/**
 * Model tier names from the routing work (lib/ai/tiers.ts on the
 * ai-model-routing branch). Agents name tiers, never raw model ids.
 */
export type TierName = "frontier" | "reasoning" | "fast" | "bulk";

/** Workflows from spec 04 "Research modes". */
export type Workflow =
  | "legal_issue_research"
  | "precedent_comparison"
  | "motion_research"
  | "document_question_answer"
  | "monitoring_suggestion";

/** Tools an agent can use inside Casevex. See lib/agents/tools.ts. */
export type ToolKey =
  | "search_law"
  | "read_matter_documents"
  | "cite_check"
  | "compare_authorities"
  | "draft_memo"
  | "draft_motion_outline"
  | "draft_client_letter"
  | "build_chronology"
  | "suggest_watch"
  | "save_to_matter";

export type OutputSection =
  | "short_answer"
  | "reasoning"
  | "contrary_authorities"
  | "risks"
  | "next_steps"
  | "sources";

/**
 * A niche inside a practice area. A playbook is an issue checklist plus the
 * sources to search first; it changes what the agent looks for, not who it
 * pretends to be.
 */
export interface Playbook {
  key: string;
  label: string;
  /** Elements, defenses and questions the agent must address or flag. */
  issueChecklist: readonly string[];
  /** Subset of the agent's allowlist to rank first. */
  preferredSources: readonly string[];
  status: AgentStatus;
}

/**
 * Evidence that gates readiness. "available" is only reachable when the
 * niche's golden set passed with zero invented citations AND an attorney
 * signed off. Until reviewers are chosen, nothing can be available.
 */
export interface ReadinessEvidence {
  goldenQuestions: number;
  adversarialCases: number;
  lastEvalPassedAt: string | null;
  inventedCitationsAccepted: number;
  attorneySignoff: { reviewer: string; at: string } | null;
  corpusConfirmed: boolean;
}

/** spec 04 agent_versions.config_json, plus Casevex additions. */
export interface AgentConfig {
  key: string;
  version: number;
  displayName: string;
  description: string;
  practiceArea: PracticeAreaKey;
  /** Status the catalog asks for; the effective status may be lower. */
  requestedStatus: AgentStatus;
  supportedJurisdictions: readonly string[];
  sourceCollectionAllowlist: readonly string[];
  workflows: readonly Workflow[];
  tools: readonly ToolKey[];
  playbooks: readonly Playbook[];
  retrieval: {
    maxCandidates: number;
    maxReranked: number;
    maxPrivateDocumentVersions: number;
    publicPrivateMix: "query_dependent" | "public_only";
  };
  output: { sections: readonly OutputSection[]; pinpointRequired: boolean };
  verification: {
    sourceExists: true;
    quoteMatches: true;
    claimSupport: true;
    treatmentStatus: "coverage_dependent";
    humanReviewRequired: true;
  };
  /** Tier per step; the drafter is always the strongest tier. */
  tiers: {
    plan: TierName;
    rerank: TierName;
    draft: TierName;
    verify: TierName;
  };
  budgets: {
    maxUSDPerRun: number;
    maxSourceTokens: number;
    maxOutputTokens: number;
  };
  monitoring: { suggestWatches: boolean; autostartWatches: false };
  readiness: ReadinessEvidence;
}
