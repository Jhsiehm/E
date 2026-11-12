import type { ModelId } from "./models";

/**
 * Model tiers. A tier is a default model chain; each AI function picks a
 * tier and may override the chain when it has a specific reason (for
 * example, the claim verifier must use a different vendor than the drafter).
 *
 * - frontier:  final legal reasoning and drafting a lawyer will read and
 *              rely on. Accuracy beats cost. Low volume.
 * - reasoning: structured legal judgment on bounded inputs (plans,
 *              verification, comparisons, deadline extraction). Medium
 *              volume, medium cost.
 * - fast:      high-volume, short, mostly structured jobs (titles,
 *              classification, reranking, summaries, routing). Cheap and
 *              quick; mistakes are caught downstream or are low stakes.
 * - bulk:      public-data-only batch work (provider feed triage). Cheapest
 *              open-weight models; never sees client data.
 */
export const TIER_NAMES = ["frontier", "reasoning", "fast", "bulk"] as const;
/** Agent profiles and other config refer to tiers by these names, never by model id. */
export type Tier = (typeof TIER_NAMES)[number];

export interface TierSpec {
  tier: Tier;
  description: string;
  /** Primary first, then fallbacks tried by OpenRouter in order. */
  chain: readonly ModelId[];
  /** Default per-call ceiling in USD; functions may lower it. */
  maxUsdPerCall: number;
  timeoutMs: number;
  /**
   * Hidden reasoning. "off" asks models to skip it (cheap, short jobs);
   * otherwise `headroomTokens` is added to max_tokens because reasoning
   * tokens are billed as output and count against the limit. Models that
   * cannot turn reasoning off get REASONING_FLOOR_TOKENS of headroom.
   */
  reasoning: { mode: "off" | "default"; headroomTokens: number };
}

export const TIERS: Record<Tier, TierSpec> = {
  frontier: {
    tier: "frontier",
    description: "Final legal reasoning and drafting that attorneys rely on.",
    chain: ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol"],
    maxUsdPerCall: 1.0,
    timeoutMs: 120_000,
    reasoning: { mode: "default", headroomTokens: 4000 },
  },
  reasoning: {
    tier: "reasoning",
    description: "Bounded structured legal judgment and verification.",
    chain: ["anthropic/claude-sonnet-5.5", "google/gemini-3.1-pro-preview"],
    maxUsdPerCall: 0.3,
    timeoutMs: 60_000,
    reasoning: { mode: "default", headroomTokens: 2000 },
  },
  fast: {
    tier: "fast",
    description: "High-volume short or structured jobs.",
    chain: ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5"],
    maxUsdPerCall: 0.03,
    timeoutMs: 20_000,
    reasoning: { mode: "off", headroomTokens: 0 },
  },
  bulk: {
    tier: "bulk",
    description: "Public-data batch work on the cheapest models.",
    chain: ["deepseek/deepseek-v4.1-flash", "qwen/qwen3.8-flash"],
    maxUsdPerCall: 0.01,
    timeoutMs: 30_000,
    reasoning: { mode: "off", headroomTokens: 0 },
  },
};

/** Headroom for a model that must reason even when its tier asks for "off". */
export const REASONING_FLOOR_TOKENS = 1_000;
