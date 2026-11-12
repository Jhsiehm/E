import {
  AI_FUNCTIONS,
  type AiFunctionKey,
  type AiFunctionSpec,
} from "./functions";
import { MODELS, allowsDataClass, isModelId, type ModelSpec } from "./models";
import { TIERS, type Tier } from "./tiers";

type Env = Record<string, string | undefined>;

export class AiRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRoutingError";
  }
}

export interface ResolvedRoute {
  fn: AiFunctionSpec;
  /** Model ids in the order OpenRouter should try them. */
  chain: string[];
  /** Catalog entries for the chain; `undefined` for an unlisted experiment model. */
  specs: (ModelSpec | undefined)[];
  maxUsdPerCall: number;
  timeoutMs: number;
  overridden: boolean;
  /** Upstream providers to pin to (union over the chain), or undefined if any model is unpinned. */
  providers?: string[];
}

/**
 * Overrides let you test other models without code changes:
 *
 *   CASEVEX_AI_OVERRIDES='{"research.draft":"openai/gpt-6.1-sol",
 *                          "tier:fast":["google/gemini-3.5-flash-lite"]}'
 *
 * A function key beats a tier key. Overrides must name catalog models that
 * are approved for the function's data class. Set CASEVEX_AI_EXPERIMENTS=1
 * to allow any OpenRouter slug while testing with synthetic data; that is
 * refused when CASEVEX_DEPLOYMENT=pilot.
 */
export function parseOverrides(env: Env): Record<string, string[]> {
  const raw = env.CASEVEX_AI_OVERRIDES?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiRoutingError("CASEVEX_AI_OVERRIDES is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new AiRoutingError("CASEVEX_AI_OVERRIDES must be a JSON object.");
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const list = Array.isArray(v) ? v : [v];
    if (!list.length || !list.every((m) => typeof m === "string" && m))
      throw new AiRoutingError(
        `CASEVEX_AI_OVERRIDES["${k}"] must be a model id or a non-empty list of ids.`,
      );
    if (!k.startsWith("tier:") && !(k in AI_FUNCTIONS))
      throw new AiRoutingError(`CASEVEX_AI_OVERRIDES has unknown key "${k}".`);
    if (k.startsWith("tier:") && !(k.slice(5) in TIERS))
      throw new AiRoutingError(`CASEVEX_AI_OVERRIDES has unknown tier "${k}".`);
    out[k] = list as string[];
  }
  return out;
}

export function experimentsEnabled(env: Env): boolean {
  if (env.CASEVEX_AI_EXPERIMENTS !== "1") return false;
  if (env.CASEVEX_DEPLOYMENT === "pilot")
    throw new AiRoutingError(
      "CASEVEX_AI_EXPERIMENTS is not allowed when CASEVEX_DEPLOYMENT=pilot.",
    );
  return true;
}

export function resolveRoute(
  key: AiFunctionKey,
  env: Env = process.env,
): ResolvedRoute {
  const fn = AI_FUNCTIONS[key];
  const tier = TIERS[fn.tier];
  const overrides = parseOverrides(env);
  const override = overrides[key] ?? overrides[`tier:${fn.tier}`];
  const chain = [...(override ?? fn.chain ?? tier.chain)];
  const experiments = experimentsEnabled(env);

  const specs = chain.map((id): ModelSpec | undefined => {
    if (isModelId(id)) {
      const spec: ModelSpec = MODELS[id];
      if (!allowsDataClass(spec, fn.dataClass))
        throw new AiRoutingError(
          `${id} is approved for public data only and cannot run ${key} (${fn.dataClass}).`,
        );
      return spec;
    }
    if (!experiments)
      throw new AiRoutingError(
        `${id} is not in the model catalog (lib/ai/models.ts). Add it there, or set CASEVEX_AI_EXPERIMENTS=1 to try it with synthetic data.`,
      );
    return undefined;
  });

  if (fn.independentOf) {
    const other = resolveRoute(fn.independentOf as AiFunctionKey, env);
    const theirs = new Set(other.specs.map((x) => x?.vendor));
    const clash = specs.find((x) => !x || theirs.has(x.vendor));
    if (clash !== undefined || specs.some((x) => !x))
      throw new AiRoutingError(
        `${key} must be independent of ${fn.independentOf}, but ${
          clash
            ? `${clash.id} shares its vendor (${clash.vendor})`
            : "an unlisted model's vendor cannot be checked"
        }. ${fn.independentOf} may run on ${other.chain.join(", ")}.`,
      );
  }

  const pinned = specs.every((s) => s?.approvedProviders?.length);
  const providers = pinned
    ? [...new Set(specs.flatMap((s) => s!.approvedProviders!))]
    : undefined;
  if (
    !providers &&
    fn.dataClass === "confidential" &&
    env.CASEVEX_DEPLOYMENT === "pilot"
  )
    throw new AiRoutingError(
      `${key} handles client data, so in pilot every model in its chain needs approvedProviders in lib/ai/models.ts.`,
    );

  return {
    fn,
    chain,
    specs,
    providers,
    maxUsdPerCall: fn.maxUsdPerCall ?? tier.maxUsdPerCall,
    timeoutMs: tier.timeoutMs,
    overridden: Boolean(override),
  };
}

/** Default primary model per function, ignoring env overrides. */
export function defaultPrimary(key: AiFunctionKey): string {
  const fn = AI_FUNCTIONS[key];
  return (fn.chain ?? TIERS[fn.tier as Tier].chain)[0];
}
