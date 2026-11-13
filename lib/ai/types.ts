import type { AiFunctionKey } from "./functions";
import type { RunBudget } from "./budget";

/** Shared shapes for the AI client (client.ts) and its helpers. */

export type Env = Record<string, string | undefined>;

/**
 * Which API a call goes through. OpenRouter serves every catalog model;
 * Anthropic serves Claude models only (see gateway.ts).
 */
export type Gateway = "openrouter" | "anthropic";

export const GATEWAY_LABEL: Record<Gateway, string> = {
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiUsage {
  functionKey: AiFunctionKey;
  tier: string;
  gateway: Gateway;
  requestedModel: string;
  modelUsed: string;
  /** Upstream provider OpenRouter routed to, e.g. "Anthropic". */
  provider?: string;
  fellBack: boolean;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /** "openrouter" when OpenRouter reported cost, "estimate" when computed from catalog list prices (always for direct Anthropic). */
  costSource: "openrouter" | "estimate";
  latencyMs: number;
  attempts: number;
  /** Why generation stopped, e.g. "stop", "length", "content_filter". */
  finishReason?: string;
  promptVersion?: string;
  generationId?: string;
}

export interface AiResult<T> {
  text: string;
  data: T;
  usage: AiUsage;
}

export interface RunAiOptions<T> {
  messages: ChatMessage[];
  /** Validates/parses the reply. For structured functions it receives parsed JSON. */
  parse?: (value: unknown) => T;
  promptVersion?: string;
  budget?: RunBudget;
  signal?: AbortSignal;
  /** Called once per successful call, e.g. to write usage_events. */
  onUsage?: (usage: AiUsage) => void | Promise<void>;
  /** Lower the function's max output for this call. */
  maxOutputTokens?: number;
}

export interface ClientDeps {
  env?: Env;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** A provider reply reduced to the fields the client needs. */
export interface NormalizedReply {
  text: string;
  finishReason?: string;
  modelUsed: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  reportedCost?: number;
  id?: string;
}
