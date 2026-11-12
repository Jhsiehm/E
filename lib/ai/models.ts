/**
 * Model catalog for Casevex AI routing (docs/ai/MODEL_ROUTING.md).
 *
 * Every model the product may call is listed here, with its OpenRouter id,
 * list price and which data it may see. Nothing outside this catalog is
 * called unless an explicit experiment override allows it (see routing.ts).
 *
 * Prices are USD per 1M tokens as listed on OpenRouter on PRICES_AS_OF.
 * They drive estimates and pre-call budget checks only; the cost recorded
 * for a real call is the `usage.cost` OpenRouter returns. Run
 * `npm run ai:check` to compare this file against the live OpenRouter
 * catalog before relying on the numbers.
 */

export const PRICES_AS_OF = "2026-11-11";

/**
 * - `public`: public law and provider feeds only (opinions, statutes,
 *   docket events). No client material.
 * - `confidential`: anything containing matter documents, client facts,
 *   strategy or attorney questions. Only models whose providers can be held
 *   to no-training and zero-data-retention routing may see this.
 */
export type DataClass = "public" | "confidential";

export type ModelVendor =
  "anthropic" | "openai" | "google" | "deepseek" | "qwen";

export interface ModelSpec {
  /** OpenRouter model slug. */
  id: string;
  vendor: ModelVendor;
  label: string;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  contextTokens: number;
  /** Highest data class this model may be sent. */
  maxDataClass: DataClass;
  /**
   * OpenRouter upstream provider slugs this model may be served by. Calls
   * are pinned to these (provider.only); if none is up, the call fails
   * rather than going to an unvetted host. Confirm each against the
   * provider's no-training / retention terms before pilot.
   */
  approvedProviders?: readonly string[];
  notes?: string;
}

export const MODELS = {
  "anthropic/claude-opus-5.5": {
    id: "anthropic/claude-opus-5.5",
    vendor: "anthropic",
    label: "Claude Opus 5.5",
    inputUsdPerMTok: 4,
    outputUsdPerMTok: 20,
    contextTokens: 1_000_000,
    maxDataClass: "confidential",
    approvedProviders: ["anthropic"],
  },
  "anthropic/claude-sonnet-5.5": {
    id: "anthropic/claude-sonnet-5.5",
    vendor: "anthropic",
    label: "Claude Sonnet 5.5",
    inputUsdPerMTok: 2,
    outputUsdPerMTok: 10,
    contextTokens: 1_000_000,
    maxDataClass: "confidential",
    approvedProviders: ["anthropic"],
  },
  "anthropic/claude-haiku-5.5": {
    id: "anthropic/claude-haiku-5.5",
    vendor: "anthropic",
    label: "Claude Haiku 5.5",
    inputUsdPerMTok: 0.1,
    outputUsdPerMTok: 0.5,
    contextTokens: 1_000_000,
    maxDataClass: "confidential",
    approvedProviders: ["anthropic"],
  },
  "openai/gpt-6.1-sol": {
    id: "openai/gpt-6.1-sol",
    vendor: "openai",
    label: "GPT-6.1 Sol",
    inputUsdPerMTok: 2,
    outputUsdPerMTok: 10,
    contextTokens: 1_050_000,
    maxDataClass: "confidential",
    approvedProviders: ["openai"],
  },
  "openai/gpt-6.1-terra": {
    id: "openai/gpt-6.1-terra",
    vendor: "openai",
    label: "GPT-6.1 Terra",
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    contextTokens: 1_050_000,
    maxDataClass: "confidential",
    approvedProviders: ["openai"],
  },
  "openai/gpt-6-luna": {
    id: "openai/gpt-6-luna",
    vendor: "openai",
    label: "GPT-6 Luna",
    inputUsdPerMTok: 0.1,
    outputUsdPerMTok: 0.5,
    contextTokens: 1_050_000,
    maxDataClass: "confidential",
    approvedProviders: ["openai"],
  },
  "google/gemini-3.1-pro-preview": {
    id: "google/gemini-3.1-pro-preview",
    vendor: "google",
    label: "Gemini 3.1 Pro (preview)",
    inputUsdPerMTok: 2,
    outputUsdPerMTok: 12,
    contextTokens: 1_050_000,
    maxDataClass: "confidential",
    approvedProviders: ["google-vertex"],
    notes:
      "Preview model: fine for fallback and testing, not as a pinned primary.",
  },
  "google/gemini-3.5-flash-lite": {
    id: "google/gemini-3.5-flash-lite",
    vendor: "google",
    label: "Gemini 3.5 Flash Lite",
    inputUsdPerMTok: 0.3,
    outputUsdPerMTok: 2.5,
    contextTokens: 1_050_000,
    maxDataClass: "confidential",
    approvedProviders: ["google-vertex"],
  },
  "deepseek/deepseek-v4.1-flash": {
    id: "deepseek/deepseek-v4.1-flash",
    vendor: "deepseek",
    label: "DeepSeek V4.1 Flash",
    inputUsdPerMTok: 0.051,
    outputUsdPerMTok: 0.5,
    contextTokens: 1_050_000,
    maxDataClass: "public",
    notes:
      "Open-weight and very cheap. Public-data jobs only until a firm approves its hosting providers for client data.",
  },
  "qwen/qwen3.8-flash": {
    id: "qwen/qwen3.8-flash",
    vendor: "qwen",
    label: "Qwen3.8 Flash",
    inputUsdPerMTok: 0.15,
    outputUsdPerMTok: 0.47,
    contextTokens: 1_000_000,
    maxDataClass: "public",
    notes: "Public-data jobs only, same reasoning as DeepSeek.",
  },
} as const satisfies Record<string, ModelSpec>;

export type ModelId = keyof typeof MODELS;

export function isModelId(id: string): id is ModelId {
  return Object.prototype.hasOwnProperty.call(MODELS, id);
}

export function getModel(id: ModelId): ModelSpec {
  return MODELS[id];
}

export function allowsDataClass(model: ModelSpec, dataClass: DataClass) {
  return dataClass === "public" || model.maxDataClass === "confidential";
}

/** List-price cost of one call, in USD. */
export function priceCall(
  model: ModelSpec,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * model.inputUsdPerMTok +
      outputTokens * model.outputUsdPerMTok) /
    1_000_000
  );
}
