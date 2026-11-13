import { AiError } from "./errors";
import type { AiFunctionKey } from "./functions";
import { getModel, isModelId } from "./models";
import type { Env, Gateway } from "./types";

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
