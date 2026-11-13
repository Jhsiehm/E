import { estimateWorstCaseUsd } from "./budget";
import { AiError } from "./errors";
import { AI_FUNCTIONS, type AiFunctionKey } from "./functions";
import { resolveGateway } from "./gateway";
import { MODELS, getModel, isModelId, priceCall } from "./models";
import { callAnthropic, callOpenRouter } from "./providers";
import { resolveRoute } from "./routing";
import { REASONING_FLOOR_TOKENS, TIERS } from "./tiers";
import { createPoster } from "./transport";
import type {
  AiResult,
  AiUsage,
  ClientDeps,
  NormalizedReply,
  RunAiOptions,
} from "./types";

export * from "./budget";
export * from "./errors";
export * from "./gateway";
export * from "./types";
export * from "./usage-events";

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

  // Reasoning tokens are billed as output and count against max_tokens.
  const tierSpec = TIERS[fn.tier];
  const mustReason = gw.chain.some(
    (id) => isModelId(id) && getModel(id).canDisableReasoning === false,
  );
  const reasoningOff = tierSpec.reasoning.mode === "off" && !mustReason;
  const headroom = reasoningOff
    ? 0
    : Math.max(
        tierSpec.reasoning.headroomTokens,
        mustReason ? REASONING_FLOOR_TOKENS : 0,
      );
  const maxTokens = maxOutputTokens + headroom;

  const worst = estimateWorstCaseUsd(route, opts.messages, maxTokens);
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
  const post = createPoster({
    key,
    gateway: gw.gateway,
    timeoutMs: route.timeoutMs,
    signal: opts.signal,
    fetch: doFetch,
    sleep,
    random,
    onAttempt: () => attempts++,
  });
  const call = {
    post,
    apiKey: gw.apiKey,
    chain: gw.chain,
    messages: opts.messages,
    maxTokens,
    fn,
  };
  const reply: NormalizedReply =
    gw.gateway === "openrouter"
      ? await callOpenRouter({ ...call, route, reasoningOff, env })
      : await callAnthropic(call);

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
      finishReason: reply.finishReason,
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
        const why =
          reply.finishReason &&
          !["stop", "end_turn"].includes(reply.finishReason)
            ? ` (generation stopped: ${reply.finishReason})`
            : "";
        throw new AiError(
          "invalid_output",
          `${key} returned text that is not JSON${why}.`,
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

/** OpenRouter may return a dated variant of the slug, e.g. "...-20261101". */
function sameModel(used: string, requested: string) {
  return used === requested || used.startsWith(`${requested}-`);
}

function stripFences(s: string) {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : s;
}
