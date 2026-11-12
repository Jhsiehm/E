import type { DataClass, ModelId } from "./models";
import type { Tier } from "./tiers";

/**
 * Registry of every AI-powered function in Casevex, mapped to a model tier.
 *
 * Inventory sources: docs/handoff/01 (product), 04 (research + agents),
 * 05 (monitoring) and the UI traceability matrix in 06. Work that the spec
 * requires to be deterministic is deliberately NOT here: source_exists,
 * quote_matches, the citation resolver, court-rule date math, ACL checks and
 * keyword/BM25 retrieval never go through a model.
 *
 * Token figures are planning estimates for one call (typical input / output
 * and hard max output). They feed the cost model in economics.ts and the
 * pre-call budget check in the client; tune them from usage_events once
 * real traffic exists.
 */

export type Surface = "web" | "mobile" | "worker";
export type Phase = "P2" | "P3" | "P4" | "P5" | "P6";

export interface AiFunctionSpec {
  key: string;
  label: string;
  /** Where the user triggers it; every call still runs server-side. */
  surfaces: readonly Surface[];
  phase: Phase;
  tier: Tier;
  dataClass: DataClass;
  /** Replaces the tier chain when set. */
  chain?: readonly ModelId[];
  /** This function's models must come from a different vendor than that function's primary. */
  independentOf?: string;
  structuredOutput: boolean;
  temperature: number;
  typicalInputTokens: number;
  typicalOutputTokens: number;
  maxOutputTokens: number;
  /** Overrides the tier ceiling when set. */
  maxUsdPerCall?: number;
  why: string;
}

const fns = [
  // ---- Research (P3) ----------------------------------------------------
  {
    key: "research.route",
    label: "Classify a chat or dashboard message",
    surfaces: ["web", "mobile"],
    phase: "P3",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 600,
    typicalOutputTokens: 60,
    maxOutputTokens: 150,
    why: "Decides whether a message needs a full research run, a document question or a quick reply. The main cost lever: it keeps trivial messages off the frontier tier.",
  },
  {
    key: "research.plan",
    label: "Structured research plan",
    surfaces: ["worker"],
    phase: "P3",
    tier: "reasoning",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 2_000,
    typicalOutputTokens: 700,
    maxOutputTokens: 1_500,
    why: "Issue, sub-issues, jurisdictions and search queries. Errors here cascade, but the input is short and the output structured, so mid tier is enough.",
  },
  {
    key: "research.rerank",
    label: "Rerank retrieved passages",
    surfaces: ["worker"],
    phase: "P3",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 12_000,
    typicalOutputTokens: 400,
    maxOutputTokens: 800,
    why: "Scores ~60 candidates down to ~12 server-owned source IDs. Large input, tiny output, runs on every research run, so it must be cheap.",
  },
  {
    key: "research.draft",
    label: "Draft the structured research answer",
    surfaces: ["worker"],
    phase: "P3",
    tier: "frontier",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0.2,
    typicalInputTokens: 18_000,
    typicalOutputTokens: 2_000,
    maxOutputTokens: 2_500,
    maxUsdPerCall: 0.6,
    why: "The product's core output: short answer, reasoning, contrary authority and limits, citing server source IDs. Highest stakes, so the strongest model.",
  },
  {
    key: "research.verify_support",
    label: "Check one claim against its cited passage",
    surfaces: ["worker"],
    phase: "P3",
    tier: "reasoning",
    dataClass: "confidential",
    chain: ["openai/gpt-6.1-terra", "google/gemini-3.1-pro-preview"],
    independentOf: "research.draft",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 2_500,
    typicalOutputTokens: 200,
    maxOutputTokens: 400,
    maxUsdPerCall: 0.05,
    why: "supports_claim check, run once per claim (~8 per answer). Spec requires an independent model, so it uses a different vendor than the drafter.",
  },
  {
    key: "research.thread_title",
    label: "Name a research thread",
    surfaces: ["web", "mobile"],
    phase: "P3",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: false,
    temperature: 0.3,
    typicalInputTokens: 300,
    typicalOutputTokens: 20,
    maxOutputTokens: 40,
    why: "Cosmetic and tiny.",
  },
  {
    key: "research.compare_authorities",
    label: "Compare two or more opinions",
    surfaces: ["web", "mobile"],
    phase: "P3",
    tier: "reasoning",
    dataClass: "public",
    structuredOutput: true,
    temperature: 0.1,
    typicalInputTokens: 16_000,
    typicalOutputTokens: 1_800,
    maxOutputTokens: 3_000,
    why: "Table of facts, procedure and holdings from verified opinions. Bounded inputs and an attorney reads the sources side by side.",
  },
  {
    key: "research.document_qa",
    label: "Answer a question about uploaded documents",
    surfaces: ["web", "mobile"],
    phase: "P3",
    tier: "reasoning",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0.1,
    typicalInputTokens: 12_000,
    typicalOutputTokens: 1_200,
    maxOutputTokens: 2_000,
    why: "Cites page/paragraph of the client's own documents; factual lookup rather than legal conclusion.",
  },
  {
    key: "motion.draft",
    label: "Draft a motion section",
    surfaces: ["web"],
    phase: "P3",
    tier: "frontier",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0.3,
    typicalInputTokens: 22_000,
    typicalOutputTokens: 4_000,
    maxOutputTokens: 6_000,
    why: "Long persuasive legal writing with citations and placeholders. Low volume, high stakes.",
  },

  // ---- Documents (P2) ---------------------------------------------------
  {
    key: "document.classify",
    label: "Classify an uploaded document",
    surfaces: ["worker"],
    phase: "P2",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 2_000,
    typicalOutputTokens: 40,
    maxOutputTokens: 100,
    why: "Complaint, contract, correspondence and so on, from the first pages. Runs on every upload.",
  },
  {
    key: "document.summarize",
    label: "Summarize an uploaded document",
    surfaces: ["worker"],
    phase: "P2",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: false,
    temperature: 0.2,
    typicalInputTokens: 8_000,
    typicalOutputTokens: 400,
    maxOutputTokens: 800,
    why: "Preview text for document lists. Runs on every upload; a summary is navigation aid, not legal analysis.",
  },
  {
    key: "document.extract_deadlines",
    label: "Find candidate deadlines in a document",
    surfaces: ["worker"],
    phase: "P2",
    tier: "reasoning",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 6_000,
    typicalOutputTokens: 300,
    maxOutputTokens: 800,
    why: "Missing a date is costly, so mid tier. Output is always an unconfirmed suggestion an attorney must confirm.",
  },

  // ---- Matters (P3/P4) --------------------------------------------------
  {
    key: "matter.suggest_summary",
    label: "Suggest a matter summary",
    surfaces: ["web", "mobile"],
    phase: "P3",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: false,
    temperature: 0.2,
    typicalInputTokens: 4_000,
    typicalOutputTokens: 300,
    maxOutputTokens: 600,
    why: "Editable draft text on the Overview tab.",
  },
  {
    key: "matter.suggest_issue_tags",
    label: "Suggest legal issue tags",
    surfaces: ["web"],
    phase: "P4",
    tier: "reasoning",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 4_000,
    typicalOutputTokens: 250,
    maxOutputTokens: 500,
    why: "Tags drive monitoring matches, so quality matters; an attorney reviews them before use.",
  },

  // ---- Monitoring and notices (P5) --------------------------------------
  {
    key: "monitor.classify_event",
    label: "Classify a provider event",
    surfaces: ["worker"],
    phase: "P5",
    tier: "bulk",
    dataClass: "public",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 2_500,
    typicalOutputTokens: 60,
    maxOutputTokens: 150,
    why: "new / modified / corrected / withdrawn ... on public feed records. Highest volume, public data only, so the cheapest models.",
  },
  {
    key: "monitor.citation_treatment",
    label: "Label how a new opinion treats a cited authority",
    surfaces: ["worker"],
    phase: "P5",
    tier: "reasoning",
    dataClass: "public",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 6_000,
    typicalOutputTokens: 250,
    maxOutputTokens: 500,
    why: "Candidate cited/distinguished/overruled labels. Only runs after deterministic filters, and stays a candidate until evidenced.",
  },
  {
    key: "monitor.impact_hypothesis",
    label: "Propose how an update affects a matter",
    surfaces: ["worker"],
    phase: "P5",
    tier: "reasoning",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0.1,
    typicalInputTokens: 5_000,
    typicalOutputTokens: 500,
    maxOutputTokens: 900,
    why: "Matter-context interpretation on the few events that survive filtering. Always labelled proposed and sent to human review.",
  },
  {
    key: "notice.digest",
    label: "Write the daily notice digest",
    surfaces: ["worker"],
    phase: "P5",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: false,
    temperature: 0.2,
    typicalInputTokens: 2_000,
    typicalOutputTokens: 300,
    maxOutputTokens: 600,
    why: "Short roll-up of already reviewed notices.",
  },

  // ---- Search (P6) ------------------------------------------------------
  {
    key: "search.interpret_query",
    label: "Interpret a global search query",
    surfaces: ["web", "mobile"],
    phase: "P6",
    tier: "fast",
    dataClass: "confidential",
    structuredOutput: true,
    temperature: 0,
    typicalInputTokens: 400,
    typicalOutputTokens: 80,
    maxOutputTokens: 150,
    why: "Turns natural language into filters for the search modal. Optional; keyword search works without it.",
  },
] as const satisfies readonly AiFunctionSpec[];

export type AiFunctionKey = (typeof fns)[number]["key"];

export const AI_FUNCTIONS: Record<AiFunctionKey, AiFunctionSpec> =
  Object.fromEntries(fns.map((f) => [f.key, f])) as unknown as Record<
    AiFunctionKey,
    AiFunctionSpec
  >;

export function isAiFunctionKey(key: string): key is AiFunctionKey {
  return Object.prototype.hasOwnProperty.call(AI_FUNCTIONS, key);
}
