import { AI_FUNCTIONS, type AiFunctionKey } from "./functions";
import { MODELS, isModelId, priceCall } from "./models";
import { resolveRoute, type ResolvedRoute } from "./routing";

/**
 * Server-side OpenRouter client. The single entry point for every model call
 * in Casevex: callers name an AI function, never a model, and routing.ts
 * decides which models run it.
 *
 *   const r = await runAiFunction("research.rerank", {
 *     messages: [{ role: "system", content: PROMPT_V3 }, { role: "user", content: passages }],
 *     promptVersion: "rerank@3",
 *     budget: runBudget,
 *     parse: parseRerank,
 *   });
 *
 * Guarantees: the API key never leaves the server; confidential functions
 * are routed only to providers that do not collect or retain data
 * (data_collection=deny, zdr); fallbacks stay inside the approved chain and
 * are reported; cost is taken from OpenRouter's usage accounting; prompt and
 * completion text are never logged here.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 2;
const CHARS_PER_TOKEN = 4;

type Env = Record<string, string | undefined>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiUsage {
  functionKey: AiFunctionKey;
  tier: string;
  requestedModel: string;
  modelUsed: string;
  /** Upstream provider OpenRouter routed to, e.g. "Anthropic". */
  provider?: string;
  fellBack: boolean;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /** "openrouter" when OpenRouter reported cost, "estimate" when computed from list prices. */
  costSource: "openrouter" | "estimate";
  latencyMs: number;
  attempts: number;
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

// ---- errors -------------------------------------------------------------

export type AiErrorCode =
  | "not_configured"
  | "budget_exceeded"
  | "rate_limited"
  | "insufficient_credits"
  | "unauthorized"
  | "bad_request"
  | "provider_error"
  | "timeout"
  | "cancelled"
  | "invalid_output";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

// ---- budgets ------------------------------------------------------------

/**
 * Hard spending ceiling shared by all calls in one research run or job
 * (agent profile `budgets.maxUSDPerRun`, 04_RESEARCH_AGENTS.md).
 */
export class RunBudget {
  spentUsd = 0;
  constructor(public readonly limitUsd: number) {}
  /** Budget from an agent profile version's config_json. */
  static fromAgentProfile(config: { budgets?: { maxUSDPerRun?: number } }) {
    const limit = config.budgets?.maxUSDPerRun;
    if (typeof limit !== "number" || !(limit > 0))
      throw new AiError(
        "budget_exceeded",
        "Agent profile has no positive budgets.maxUSDPerRun.",
      );
    return new RunBudget(limit);
  }
  get remainingUsd() {
    return Math.max(0, this.limitUsd - this.spentUsd);
  }
  record(usd: number) {
    this.spentUsd += usd;
  }
}

/** Worst-case cost of a call before sending it, using the priciest model in the chain. */
export function estimateWorstCaseUsd(
  route: ResolvedRoute,
  messages: ChatMessage[],
  maxOutputTokens: number,
): number {
  const inputTokens = Math.ceil(
    messages.reduce((n, m) => n + m.content.length, 0) / CHARS_PER_TOKEN,
  );
  const costs = route.specs.map((s) =>
    s ? priceCall(s, inputTokens, maxOutputTokens) : 0,
  );
  return Math.max(0, ...costs);
}

// ---- main entry ---------------------------------------------------------

export async function runAiFunction<T = string>(
  key: AiFunctionKey,
  opts: RunAiOptions<T>,
  deps: ClientDeps = {},
): Promise<AiResult<T>> {
  if (typeof window !== "undefined")
    throw new AiError("not_configured", "runAiFunction is server-only.");

  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;

  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey)
    throw new AiError(
      "not_configured",
      "OPENROUTER_API_KEY is not set, so AI functions are off.",
    );

  const route = resolveRoute(key, env);
  const fn = AI_FUNCTIONS[key];
  const maxOutputTokens = Math.min(
    opts.maxOutputTokens ?? fn.maxOutputTokens,
    fn.maxOutputTokens,
  );

  const worst = estimateWorstCaseUsd(route, opts.messages, maxOutputTokens);
  if (worst > route.maxUsdPerCall)
    throw new AiError(
      "budget_exceeded",
      `${key} could cost up to $${worst.toFixed(4)}, above its $${route.maxUsdPerCall} per-call ceiling. Send less context.`,
    );
  if (opts.budget && worst > opts.budget.remainingUsd)
    throw new AiError(
      "budget_exceeded",
      `${key} could cost up to $${worst.toFixed(4)} but only $${opts.budget.remainingUsd.toFixed(4)} is left in this run's budget.`,
    );

  const body: Record<string, unknown> = {
    messages: opts.messages,
    max_tokens: maxOutputTokens,
    temperature: fn.temperature,
    usage: { include: true },
    provider: {
      data_collection: "deny",
      ...(route.providers ? { only: route.providers } : {}),
      ...(fn.dataClass === "confidential" ? { zdr: true } : {}),
      ...(fn.structuredOutput ? { require_parameters: true } : {}),
    },
    ...(fn.structuredOutput
      ? { response_format: { type: "json_object" } }
      : {}),
  };
  if (route.chain.length > 1) body.models = route.chain;
  else body.model = route.chain[0];

  const started = now();
  let attempt = 0;
  for (;;) {
    attempt++;
    const timeout = AbortSignal.timeout(route.timeoutMs);
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, timeout])
      : timeout;

    let res: Response;
    try {
      res = await doFetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.CASEVEX_APP_URL ?? "https://casevex.vercel.app",
          "X-Title": "Casevex",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (opts.signal?.aborted)
        throw new AiError("cancelled", `${key} was cancelled.`);
      const isTimeout = timeout.aborted;
      if (attempt <= MAX_RETRIES) {
        await sleep(backoff(attempt, random));
        continue;
      }
      throw new AiError(
        isTimeout ? "timeout" : "provider_error",
        isTimeout
          ? `${key} timed out after ${route.timeoutMs}ms.`
          : `Could not reach OpenRouter: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      const retryable = [408, 429, 500, 502, 503, 504].includes(res.status);
      if (retryable && attempt <= MAX_RETRIES) {
        const ra = Number(res.headers.get("retry-after"));
        await sleep(
          Number.isFinite(ra) && ra > 0
            ? Math.min(ra * 1000, 10_000)
            : backoff(attempt, random),
        );
        continue;
      }
      throw await providerError(res);
    }

    const json = (await res.json()) as OpenRouterResponse;
    if (json.error)
      throw new AiError(
        "provider_error",
        `OpenRouter error: ${json.error.message ?? "unknown"}`,
        json.error.code,
      );
    const text = json.choices?.[0]?.message?.content ?? "";
    const modelUsed = json.model ?? route.chain[0];
    const promptTokens = json.usage?.prompt_tokens ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;
    const reported = json.usage?.cost;
    const costUsd =
      typeof reported === "number"
        ? reported
        : isModelId(modelUsed)
          ? priceCall(MODELS[modelUsed], promptTokens, completionTokens)
          : 0;

    const usage: AiUsage = {
      functionKey: key,
      tier: fn.tier,
      requestedModel: route.chain[0],
      modelUsed,
      provider: json.provider,
      fellBack: !sameModel(modelUsed, route.chain[0]),
      promptTokens,
      completionTokens,
      costUsd,
      costSource: typeof reported === "number" ? "openrouter" : "estimate",
      latencyMs: now() - started,
      attempts: attempt,
      promptVersion: opts.promptVersion,
      generationId: json.id,
    };
    opts.budget?.record(costUsd);
    await opts.onUsage?.(usage);

    let data: unknown = text;
    if (fn.structuredOutput) {
      try {
        data = JSON.parse(stripFences(text));
      } catch {
        throw new AiError(
          "invalid_output",
          `${key} returned text that is not JSON.`,
        );
      }
    }
    try {
      return { text, data: opts.parse ? opts.parse(data) : (data as T), usage };
    } catch (err) {
      throw new AiError(
        "invalid_output",
        `${key} output failed validation: ${(err as Error).message}`,
      );
    }
  }
}

// ---- helpers ------------------------------------------------------------

interface OpenRouterResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
}

function backoff(attempt: number, random: () => number) {
  const base = 500 * 2 ** (attempt - 1);
  return base + Math.floor(random() * base);
}

/** OpenRouter may return a dated variant of the slug, e.g. "...-20261101". */
function sameModel(used: string, requested: string) {
  return used === requested || used.startsWith(`${requested}-`);
}

function stripFences(s: string) {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : s;
}

async function providerError(res: Response): Promise<AiError> {
  let message = `OpenRouter returned ${res.status}.`;
  try {
    const b = (await res.json()) as OpenRouterResponse;
    if (b.error?.message) message = `OpenRouter: ${b.error.message}`;
  } catch {
    /* body was not JSON */
  }
  const code: AiErrorCode =
    res.status === 401 || res.status === 403
      ? "unauthorized"
      : res.status === 402
        ? "insufficient_credits"
        : res.status === 429
          ? "rate_limited"
          : res.status === 400
            ? "bad_request"
            : res.status === 408
              ? "timeout"
              : "provider_error";
  return new AiError(code, message, res.status);
}

// ---- usage_events --------------------------------------------------------

/** Row for usage_events (02_ARCHITECTURE_DATA_SECURITY.md). Holds no prompt or reply text. */
export interface UsageEventRow {
  workspace_id: string;
  user_id: string | null;
  run_id: string | null;
  provider: string;
  units: {
    function_key: string;
    tier: string;
    model_id: string;
    requested_model_id: string;
    fell_back: boolean;
    input_tokens: number;
    output_tokens: number;
    cost_source: "openrouter" | "estimate";
    prompt_version?: string;
    generation_id?: string;
    latency_ms: number;
  };
  cost_usd: number;
}

export function toUsageEvent(
  usage: AiUsage,
  ctx: { workspaceId: string; userId?: string | null; runId?: string | null },
): UsageEventRow {
  return {
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId ?? null,
    run_id: ctx.runId ?? null,
    provider: usage.provider ? `openrouter/${usage.provider}` : "openrouter",
    units: {
      function_key: usage.functionKey,
      tier: usage.tier,
      model_id: usage.modelUsed,
      requested_model_id: usage.requestedModel,
      fell_back: usage.fellBack,
      input_tokens: usage.promptTokens,
      output_tokens: usage.completionTokens,
      cost_source: usage.costSource,
      prompt_version: usage.promptVersion,
      generation_id: usage.generationId,
      latency_ms: usage.latencyMs,
    },
    cost_usd: usage.costUsd,
  };
}
