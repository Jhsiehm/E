/**
 * The AI model slot the legal pipeline calls. Structurally identical to
 * `complete` from `@/lib/ai` (AI model routing, OpenRouter), so the routing
 * module plugs in with `createResearch({ complete })` and no adapter code.
 * Kept as a type here only until lib/ai is on main; then this file becomes a
 * re-export.
 *
 * Retrieval and verification never need a model: with no `complete` given,
 * research falls back to an extractive answer built only from passages.
 */

/** Task keys registered in the model routing table. */
export type LegalModelTask =
  | "research.plan"
  | "research.draft"
  | "research.verify_support"
  | "research.rerank";

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResponseSchema<T> {
  parse(value: unknown): T;
}

export interface CompleteRequest<T> {
  task: LegalModelTask;
  messages: ModelMessage[];
  responseSchema?: ResponseSchema<T> | ((value: unknown) => T);
  /** USD number, or the shared RunBudget object from @/lib/ai. */
  budgetUsd: number | object;
  promptVersion?: string;
  signal?: AbortSignal;
}

export interface CompleteResult<T> {
  output: T;
  modelId: string;
  provider: string;
  costUsd: number;
}

export type Complete = <T>(
  req: CompleteRequest<T>,
) => Promise<CompleteResult<T>>;
