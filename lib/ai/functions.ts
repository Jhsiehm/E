import { DOCUMENT_FUNCTIONS } from "./functions/documents";
import { MONITORING_FUNCTIONS } from "./functions/monitoring";
import { RESEARCH_FUNCTIONS } from "./functions/research";
import type { AiFunctionSpec } from "./function-spec";

export type { AiFunctionSpec, Phase, Surface } from "./function-spec";

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

// The entries live in functions/*, grouped by area, to keep each file short.
const fns = [
  ...RESEARCH_FUNCTIONS,
  ...DOCUMENT_FUNCTIONS,
  ...MONITORING_FUNCTIONS,
] as const;

export type AiFunctionKey = (typeof fns)[number]["key"];

export const AI_FUNCTIONS: Record<AiFunctionKey, AiFunctionSpec> =
  Object.fromEntries(fns.map((f) => [f.key, f])) as unknown as Record<
    AiFunctionKey,
    AiFunctionSpec
  >;

export function isAiFunctionKey(key: string): key is AiFunctionKey {
  return Object.prototype.hasOwnProperty.call(AI_FUNCTIONS, key);
}
