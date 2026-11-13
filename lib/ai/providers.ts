import { AiError } from "./errors";
import type { AiFunctionSpec } from "./functions";
import { getModel, type ModelId } from "./models";
import type { ResolvedRoute } from "./routing";
import type { Post } from "./transport";
import type { ChatMessage, Env, NormalizedReply } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface CallInput {
  post: Post;
  apiKey: string;
  chain: string[];
  messages: ChatMessage[];
  maxTokens: number;
  fn: AiFunctionSpec;
}

interface OpenRouterResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** One OpenRouter call; OpenRouter runs fallback across the chain itself. */
export async function callOpenRouter(
  c: CallInput & { route: ResolvedRoute; reasoningOff: boolean; env: Env },
): Promise<NormalizedReply> {
  const body: Record<string, unknown> = {
    messages: c.messages,
    max_tokens: c.maxTokens,
    temperature: c.fn.temperature,
    usage: { include: true },
    ...(c.reasoningOff ? { reasoning: { enabled: false } } : {}),
    // No require_parameters: live tests showed it excludes every
    // zero-retention host once temperature is set. JSON mode is
    // best-effort; replies are parsed and validated by the client either way.
    provider: {
      data_collection: "deny",
      ...(c.route.providers ? { only: c.route.providers } : {}),
      ...(c.fn.dataClass === "confidential" ? { zdr: true } : {}),
    },
    ...(c.fn.structuredOutput
      ? { response_format: { type: "json_object" } }
      : {}),
  };
  if (c.chain.length > 1) body.models = c.chain;
  else body.model = c.chain[0];
  const json = (await c.post(
    OPENROUTER_URL,
    {
      Authorization: `Bearer ${c.apiKey}`,
      "HTTP-Referer": c.env.CASEVEX_APP_URL ?? "https://casevex.vercel.app",
      "X-Title": "Casevex",
    },
    body,
  )) as OpenRouterResponse;
  if (json.error)
    throw new AiError(
      "provider_error",
      `OpenRouter error: ${json.error.message ?? "unknown"}`,
      json.error.code,
    );
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    finishReason: json.choices?.[0]?.finish_reason,
    modelUsed: json.model ?? c.chain[0],
    provider: json.provider,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    reportedCost: json.usage?.cost,
    id: json.id,
  };
}

/**
 * Direct Anthropic Messages API. Fallback runs here, in chain order, only
 * across the Claude models of the approved chain.
 */
export async function callAnthropic(c: CallInput): Promise<NormalizedReply> {
  const system = c.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = c.messages.filter((m) => m.role !== "system");
  let lastErr: unknown;
  for (const slug of c.chain) {
    const spec = getModel(slug as ModelId);
    try {
      const json = (await c.post(
        ANTHROPIC_URL,
        { "x-api-key": c.apiKey, "anthropic-version": ANTHROPIC_VERSION },
        {
          model: spec.anthropicModelId,
          max_tokens: c.maxTokens,
          temperature: c.fn.temperature,
          ...(system ? { system } : {}),
          messages: turns,
        },
      )) as AnthropicResponse;
      return {
        text: (json.content ?? [])
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join(""),
        modelUsed: slug,
        provider: "Anthropic",
        finishReason: json.stop_reason,
        promptTokens: json.usage?.input_tokens ?? 0,
        completionTokens: json.usage?.output_tokens ?? 0,
        id: json.id,
      };
    } catch (err) {
      lastErr = err;
      const fallThrough =
        err instanceof AiError &&
        ["provider_error", "rate_limited", "timeout"].includes(err.code);
      if (!fallThrough) throw err;
    }
  }
  throw lastErr;
}
