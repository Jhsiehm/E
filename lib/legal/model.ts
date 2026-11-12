/**
 * The AI model slot the legal pipeline calls: `complete` from the AI model
 * routing module (@/lib/ai, OpenRouter / Anthropic). Injected rather than
 * imported by research.ts so tests can pass a fake.
 *
 * Retrieval and verification never need a model: with no `complete` given,
 * or no AI key configured, research falls back to an extractive answer built
 * only from passages.
 */
import type { complete } from "../ai";

export type {
  ChatMessage as ModelMessage,
  CompleteRequest,
  CompleteResult,
} from "../ai";
export { AiError, RunBudget } from "../ai";

/** Task keys the legal pipeline uses (registered in lib/ai/functions.ts). */
export type LegalModelTask =
  | "research.plan"
  | "research.draft"
  | "research.verify_support"
  | "research.rerank";

export type Complete = typeof complete;
