import { AI_FUNCTIONS, type AiFunctionKey } from "./functions";
import { MODELS, getModel, isModelId, priceCall, type ModelId } from "./models";
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
 * Gateways: OpenRouter (OPENROUTER_API_KEY, every model) or Anthropic direct
 * (ANTHROPIC_API_KEY, Claude models only); see resolveGateway below.
 *
 * Guarantees: the API keys never leave the server; confidential functions
 * are routed only to providers that do not collect or retain data
 * (data_collection=deny, zdr); fallbacks stay inside the approved chain and
 * are reported; cost is taken from OpenRouter's usage accounting; prompt and
 * completion text are never logged here.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/** 529 is Anthropic's "overloaded". */
const RETRYABLE = [408, 429, 500, 502, 503, 504, 529];
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

  const route = resolveRoute(key, env);
  const fn = AI_FUNCTIONS[key];
  const gw = resolveGateway(key, route.chain, env);
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

  const started = now();
  let attempts = 0;
  /** POSTs with timeout, retries with jitter on retryable statuses, returns parsed JSON. */
  const post = async (
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<unknown> => {
    for (let attempt = 1; ; attempt++) {
      attempts++;
      const timeout = AbortSignal.timeout(route.timeoutMs);
      const signal = opts.signal
        ? AbortSignal.any([opts.signal, timeout])
        : timeout;
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
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
            : `Could not reach ${GATEWAY_LABEL[gw.gateway]}: ${(err as Error).message}`,
        );
      }
      if (!res.ok) {
        if (RETRYABLE.includes(res.status) && attempt <= MAX_RETRIES) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(
            Number.isFinite(ra) && ra > 0
              ? Math.min(ra * 1000, 10_000)
              : backoff(attempt, random),
          );
          continue;
        }
        throw await providerError(res, gw.gateway);
      }
      try {
        return await res.json();
      } catch {
        if (attempt <= MAX_RETRIES) {
          await sleep(backoff(attempt, random));
          continue;
        }
        throw new AiError(
          "provider_error",
          `${GATEWAY_LABEL[gw.gateway]} returned a response that is not JSON.`,
          res.status,
        );
      }
    }
  };

  let reply: NormalizedReply;
  if (gw.gateway === "openrouter") {
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
    if (gw.chain.length > 1) body.models = gw.chain;
    else body.model = gw.chain[0];
    const json = (await post(
      OPENROUTER_URL,
      {
        Authorization: `Bearer ${gw.apiKey}`,
        "HTTP-Referer": env.CASEVEX_APP_URL ?? "https://casevex.vercel.app",
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
    reply = {
      text: json.choices?.[0]?.message?.content ?? "",
      modelUsed: json.model ?? gw.chain[0],
      provider: json.provider,
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      reportedCost: json.usage?.cost,
      id: json.id,
    };
  } else {
    // Direct Anthropic Messages API. Fallback runs here, in chain order,
    // only across the Claude models of the approved chain.
    const system = opts.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const turns = opts.messages.filter((m) => m.role !== "system");
    let lastErr: unknown;
    let got: NormalizedReply | undefined;
    for (const slug of gw.chain) {
      const spec = getModel(slug as ModelId);
      try {
        const json = (await post(
          ANTHROPIC_URL,
          { "x-api-key": gw.apiKey, "anthropic-version": ANTHROPIC_VERSION },
          {
            model: spec.anthropicModelId,
            max_tokens: maxOutputTokens,
            temperature: fn.temperature,
            ...(system ? { system } : {}),
            messages: turns,
          },
        )) as AnthropicResponse;
        got = {
          text: (json.content ?? [])
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join(""),
          modelUsed: slug,
          provider: "Anthropic",
          promptTokens: json.usage?.input_tokens ?? 0,
          completionTokens: json.usage?.output_tokens ?? 0,
          id: json.id,
        };
        break;
      } catch (err) {
        lastErr = err;
        const fallThrough =
          err instanceof AiError &&
          ["provider_error", "rate_limited", "timeout"].includes(err.code);
        if (!fallThrough) throw err;
      }
    }
    if (!got) throw lastErr;
    reply = got;
  }

  const { text, modelUsed, promptTokens, completionTokens, reportedCost } =
    reply;
  // Price by the chain entry that served the call (OpenRouter may return a
  // dated slug). If it cannot be matched, charge the pre-call worst case
  // rather than 0 so the run budget is never under-counted.
  const servedBy = route.chain.find((id) => sameModel(modelUsed, id));
  const costUsd =
    typeof reportedCost === "number"
      ? reportedCost
      : servedBy && isModelId(servedBy)
        ? priceCall(MODELS[servedBy], promptTokens, completionTokens)
        : worst;

  {
    const usage: AiUsage = {
      functionKey: key,
      tier: fn.tier,
      gateway: gw.gateway,
      requestedModel: route.chain[0],
      modelUsed,
      provider: reply.provider,
      fellBack: !sameModel(modelUsed, route.chain[0]),
      promptTokens,
      completionTokens,
      costUsd,
      costSource: typeof reportedCost === "number" ? "openrouter" : "estimate",
      latencyMs: now() - started,
      attempts,
      promptVersion: opts.promptVersion,
      generationId: reply.id,
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

// ---- gateways -----------------------------------------------------------

/**
 * Which API a call goes through, picked from the keys in the environment:
 *
 * - OPENROUTER_API_KEY: every catalog model, with privacy routing.
 * - ANTHROPIC_API_KEY: Claude models only, straight to Anthropic. Functions
 *   whose chain has no Claude model (e.g. the independent verifier, bulk
 *   feed triage) need OpenRouter.
 *
 * CASEVEX_AI_GATEWAY=auto (default) prefers OpenRouter when its key is set,
 * otherwise Anthropic. Set it to "openrouter" or "anthropic" to force one.
 */
export type Gateway = "openrouter" | "anthropic";

const GATEWAY_LABEL: Record<Gateway, string> = {
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
};

export function resolveGateway(
  key: AiFunctionKey,
  chain: readonly string[],
  env: Env,
): { gateway: Gateway; apiKey: string; chain: string[] } {
  const pref = (env.CASEVEX_AI_GATEWAY?.trim() || "auto").toLowerCase();
  if (!["auto", "openrouter", "anthropic"].includes(pref))
    throw new AiError(
      "not_configured",
      `CASEVEX_AI_GATEWAY must be auto, openrouter or anthropic (got "${pref}").`,
    );
  const orKey = env.OPENROUTER_API_KEY?.trim();
  const anKey = env.ANTHROPIC_API_KEY?.trim();
  const claude = chain.filter(
    (id) => isModelId(id) && getModel(id).anthropicModelId,
  );

  const viaOpenRouter = () => {
    if (!orKey)
      throw new AiError(
        "not_configured",
        "CASEVEX_AI_GATEWAY=openrouter but OPENROUTER_API_KEY is not set.",
      );
    return { gateway: "openrouter" as const, apiKey: orKey, chain: [...chain] };
  };
  const viaAnthropic = () => {
    if (!anKey)
      throw new AiError(
        "not_configured",
        "CASEVEX_AI_GATEWAY=anthropic but ANTHROPIC_API_KEY is not set.",
      );
    if (!claude.length)
      throw new AiError(
        "not_configured",
        `${key} runs on ${chain.join(", ")}, which Anthropic does not serve. Set OPENROUTER_API_KEY, or override it to a Claude model.`,
      );
    return { gateway: "anthropic" as const, apiKey: anKey, chain: claude };
  };

  if (pref === "openrouter") return viaOpenRouter();
  if (pref === "anthropic") return viaAnthropic();
  if (orKey) return viaOpenRouter();
  if (anKey) return viaAnthropic();
  throw new AiError(
    "not_configured",
    "No AI key is set. Add OPENROUTER_API_KEY or ANTHROPIC_API_KEY to turn AI functions on.",
  );
}

interface NormalizedReply {
  text: string;
  modelUsed: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  reportedCost?: number;
  id?: string;
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
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

async function providerError(
  res: Response,
  gateway: Gateway,
): Promise<AiError> {
  const name = GATEWAY_LABEL[gateway];
  let message = `${name} returned ${res.status}.`;
  try {
    const b = (await res.json()) as { error?: { message?: string } };
    if (b.error?.message) message = `${name}: ${b.error.message}`;
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
    provider:
      usage.gateway === "anthropic"
        ? "anthropic"
        : usage.provider
          ? `openrouter/${usage.provider}`
          : "openrouter",
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
